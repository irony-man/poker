package com.pokr.android.feature.table

import android.content.Context
import android.media.AudioManager
import com.pokr.android.core.model.VoiceIceCandidate
import com.pokr.android.core.model.VoicePeer
import com.pokr.android.core.model.VoiceSignalPayload
import java.util.concurrent.ConcurrentHashMap
import org.webrtc.AudioSource
import org.webrtc.AudioTrack
import org.webrtc.DataChannel
import org.webrtc.IceCandidate
import org.webrtc.MediaConstraints
import org.webrtc.MediaStream
import org.webrtc.PeerConnection
import org.webrtc.PeerConnectionFactory
import org.webrtc.RtpReceiver
import org.webrtc.SdpObserver
import org.webrtc.SessionDescription
import org.webrtc.audio.JavaAudioDeviceModule

enum class VoiceCallState { Idle, Joining, Connected, Error }

data class VoiceCallSnapshot(
    val state: VoiceCallState = VoiceCallState.Idle,
    val muted: Boolean = true,
    val peers: List<VoicePeer> = emptyList(),
    val error: String? = null,
)

class VoiceCallSession(
    context: Context,
    private val userId: String,
    private val sendSignal: (toUserId: String, signal: VoiceSignalPayload) -> Unit,
) {
    private val appContext = context.applicationContext
    private val audioManager = appContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    private val iceServers = listOf(
        PeerConnection.IceServer.builder("stun:stun.l.google.com:19302").createIceServer(),
    )
    private val rtcConfig = PeerConnection.RTCConfiguration(iceServers).apply {
        sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN
    }

    private var factory: PeerConnectionFactory? = null
    private var audioSource: AudioSource? = null
    private var localTrack: AudioTrack? = null
    private val peers = ConcurrentHashMap<String, PeerConnection>()
    private val roster = ConcurrentHashMap<String, VoicePeer>()
    @Volatile var snapshot: VoiceCallSnapshot = VoiceCallSnapshot()
        private set
    private var listener: ((VoiceCallSnapshot) -> Unit)? = null

    fun subscribe(listener: (VoiceCallSnapshot) -> Unit) {
        this.listener = listener
        listener(snapshot)
    }

    private fun emit(update: VoiceCallSnapshot) {
        snapshot = update
        listener?.invoke(update)
    }

    fun join() {
        if (snapshot.state == VoiceCallState.Joining || snapshot.state == VoiceCallState.Connected) return
        emit(snapshot.copy(state = VoiceCallState.Joining, error = null))
        try {
            ensureFactory()
            val source = factory!!.createAudioSource(MediaConstraints())
            val track = factory!!.createAudioTrack("pokr-audio", source)
            track.setEnabled(false)
            audioSource = source
            localTrack = track
            audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
            audioManager.isSpeakerphoneOn = true
            emit(snapshot.copy(state = VoiceCallState.Connected, muted = true, error = null))
        } catch (err: Exception) {
            emit(
                snapshot.copy(
                    state = VoiceCallState.Error,
                    error = err.message ?: "Could not access microphone",
                ),
            )
            leave()
        }
    }

    fun leave() {
        peers.values.forEach { it.close() }
        peers.clear()
        roster.clear()
        localTrack?.setEnabled(false)
        localTrack?.dispose()
        localTrack = null
        audioSource?.dispose()
        audioSource = null
        audioManager.mode = AudioManager.MODE_NORMAL
        emit(VoiceCallSnapshot())
    }

    fun setMuted(muted: Boolean) {
        localTrack?.setEnabled(!muted)
        emit(snapshot.copy(muted = muted))
    }

    fun toggleMuted() = setMuted(!snapshot.muted)

    fun applyRoster(list: List<VoicePeer>) {
        roster.clear()
        list.forEach { roster[it.userId] = it }
        if (snapshot.state == VoiceCallState.Connected) {
            list.filter { it.userId != userId && !peers.containsKey(it.userId) }
                .forEach { createOffer(it.userId) }
        }
        emit(snapshot.copy(peers = roster.values.filter { it.userId != userId }))
    }

    fun onPeerJoined(peer: VoicePeer) {
        roster[peer.userId] = peer
        emit(snapshot.copy(peers = roster.values.filter { it.userId != userId }))
    }

    fun onPeerLeft(peerId: String) {
        roster.remove(peerId)
        peers.remove(peerId)?.close()
        emit(snapshot.copy(peers = roster.values.filter { it.userId != userId }))
    }

    fun handleSignal(fromUserId: String, signal: VoiceSignalPayload) {
        if (fromUserId == userId || snapshot.state != VoiceCallState.Connected) return
        val pc = ensurePeer(fromUserId)
        when (signal.type) {
            "offer" -> {
                val sdp = signal.sdp ?: return
                pc.setRemoteDescription(EmptySdp(), SessionDescription(SessionDescription.Type.OFFER, sdp))
                pc.createAnswer(object : SdpObserver {
                    override fun onCreateSuccess(desc: SessionDescription) {
                        pc.setLocalDescription(EmptySdp(), desc)
                        sendSignal(fromUserId, VoiceSignalPayload(type = "answer", sdp = desc.description))
                    }
                    override fun onSetSuccess() = Unit
                    override fun onCreateFailure(error: String?) = Unit
                    override fun onSetFailure(error: String?) = Unit
                }, MediaConstraints())
            }
            "answer" -> {
                val sdp = signal.sdp ?: return
                pc.setRemoteDescription(EmptySdp(), SessionDescription(SessionDescription.Type.ANSWER, sdp))
            }
            "ice" -> {
                val c = signal.candidate ?: return
                val mid = c.sdpMid ?: return
                val index = c.sdpMLineIndex ?: return
                val cand = c.candidate ?: return
                pc.addIceCandidate(IceCandidate(mid, index, cand))
            }
        }
    }

    private fun createOffer(peerId: String) {
        val pc = ensurePeer(peerId)
        pc.createOffer(object : SdpObserver {
            override fun onCreateSuccess(desc: SessionDescription) {
                pc.setLocalDescription(EmptySdp(), desc)
                sendSignal(peerId, VoiceSignalPayload(type = "offer", sdp = desc.description))
            }
            override fun onSetSuccess() = Unit
            override fun onCreateFailure(error: String?) = Unit
            override fun onSetFailure(error: String?) = Unit
        }, MediaConstraints())
    }

    private fun ensurePeer(peerId: String): PeerConnection {
        peers[peerId]?.let { return it }
        val observer = object : PeerConnection.Observer {
            override fun onSignalingChange(state: PeerConnection.SignalingState?) = Unit
            override fun onIceConnectionChange(state: PeerConnection.IceConnectionState?) {
                if (state == PeerConnection.IceConnectionState.FAILED ||
                    state == PeerConnection.IceConnectionState.CLOSED
                ) {
                    onPeerLeft(peerId)
                }
            }
            override fun onIceConnectionReceivingChange(receiving: Boolean) = Unit
            override fun onIceGatheringChange(state: PeerConnection.IceGatheringState?) = Unit
            override fun onIceCandidate(candidate: IceCandidate) {
                sendSignal(
                    peerId,
                    VoiceSignalPayload(
                        type = "ice",
                        candidate = VoiceIceCandidate(
                            candidate = candidate.sdp,
                            sdpMid = candidate.sdpMid,
                            sdpMLineIndex = candidate.sdpMLineIndex,
                        ),
                    ),
                )
            }
            override fun onIceCandidatesRemoved(candidates: Array<out IceCandidate>?) = Unit
            override fun onAddStream(stream: MediaStream?) = Unit
            override fun onRemoveStream(stream: MediaStream?) = Unit
            override fun onDataChannel(channel: DataChannel?) = Unit
            override fun onRenegotiationNeeded() = Unit
            override fun onAddTrack(receiver: RtpReceiver?, streams: Array<out MediaStream>?) = Unit
        }
        val pc = factory!!.createPeerConnection(rtcConfig, observer)
            ?: error("Could not create peer connection")
        localTrack?.let { pc.addTrack(it) }
        peers[peerId] = pc
        return pc
    }

    private fun ensureFactory() {
        if (factory != null) return
        synchronized(FactoryLock) {
            if (!initialized) {
                PeerConnectionFactory.initialize(
                    PeerConnectionFactory.InitializationOptions.builder(appContext)
                        .createInitializationOptions(),
                )
                initialized = true
            }
        }
        val adm = JavaAudioDeviceModule.builder(appContext).createAudioDeviceModule()
        factory = PeerConnectionFactory.builder()
            .setAudioDeviceModule(adm)
            .createPeerConnectionFactory()
    }

    private class EmptySdp : SdpObserver {
        override fun onCreateSuccess(desc: SessionDescription?) = Unit
        override fun onSetSuccess() = Unit
        override fun onCreateFailure(error: String?) = Unit
        override fun onSetFailure(error: String?) = Unit
    }

    companion object {
        private val FactoryLock = Any()
        @Volatile private var initialized = false
    }
}
