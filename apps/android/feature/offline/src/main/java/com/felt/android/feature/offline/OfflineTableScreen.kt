package com.felt.android.feature.offline

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.felt.android.core.designsystem.FeltColors
import com.felt.android.core.designsystem.FeltGhostButton
import com.felt.android.core.designsystem.FeltPrimaryButton
import com.felt.android.core.designsystem.FeltTableLayout
import com.felt.android.core.designsystem.HudPanel
import com.felt.android.core.designsystem.LegalActionsUi
import com.felt.android.core.designsystem.StatusChip
import com.felt.android.core.designsystem.TableActionControls
import com.felt.android.core.designsystem.TablePlayerUi
import com.felt.android.core.designsystem.TableUiState

@Composable
fun OfflineTableScreen(
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: OfflineViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    var chatInput by remember { mutableStateOf("") }

    Box(modifier = modifier.fillMaxSize()) {
        if (!state.bootstrapped || state.publicTable == null) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = FeltColors.Gold)
            }
            return
        }

        val table = state.publicTable!!

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(12.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                FeltGhostButton(text = "← Lobby", onClick = onBack)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    StatusChip(text = "Offline", accent = FeltColors.Neon)
                    StatusChip(text = table.street, accent = FeltColors.Cyan)
                }
            }

            FeltTableLayout(
                table = table.toOfflineTableUi(),
                userId = HUMAN_USER_ID,
                holeCards = state.holeCards,
                onSit = {},
            )

            TableActionControls(
                table = table.toOfflineTableUi(),
                userId = HUMAN_USER_ID,
                legal = state.legal?.let {
                    LegalActionsUi(it.types, it.callAmount, it.minRaiseTo, it.maxRaiseTo)
                },
                onAction = { action, amount -> viewModel.sendAction(action, amount) },
            )

            if (table.street == "waiting" || table.street == "payout") {
                FeltGhostButton(
                    text = if (table.street == "waiting") "Start hand" else "Next hand",
                    onClick = viewModel::startHandManual,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 8.dp),
                )
            }
        }

        Row(
            modifier = Modifier
                .align(Alignment.TopEnd)
                .padding(12.dp),
        ) {
            FeltGhostButton(
                text = if (state.chatOpen) "Hide chat" else "Chat",
                onClick = viewModel::toggleChat,
            )
        }

        if (state.chatOpen) {
            HudPanel(
                modifier = Modifier
                    .align(Alignment.CenterEnd)
                    .width(280.dp)
                    .padding(8.dp),
            ) {
                Column {
                    Text("Chat", color = FeltColors.Gold, fontWeight = FontWeight.Bold)
                    LazyColumn(modifier = Modifier.weight(1f, fill = false)) {
                        items(state.chat) { msg ->
                            Text(
                                "${msg.name}: ${msg.text}",
                                color = FeltColors.Cream.copy(alpha = 0.85f),
                            )
                        }
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        listOf("👍", "😂", "🔥").forEach { emoji ->
                            FeltGhostButton(text = emoji, onClick = { viewModel.sendEmoji(emoji) })
                        }
                    }
                    Row {
                        OutlinedTextField(
                            value = chatInput,
                            onValueChange = { chatInput = it },
                            modifier = Modifier.weight(1f),
                            singleLine = true,
                        )
                        FeltPrimaryButton(
                            text = "Send",
                            onClick = {
                                viewModel.sendChat(chatInput)
                                chatInput = ""
                            },
                        )
                    }
                }
            }
        }
    }
}
