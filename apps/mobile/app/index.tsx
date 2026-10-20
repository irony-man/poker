import { API_URL, WS_URL } from '@/core/env';
import { sharedPackageSmoke } from '@/smoke';
import { Platform, StyleSheet, Text, View } from 'react-native';

export default function ScaffoldScreen() {
  const smoke = sharedPackageSmoke();
  const linked = smoke.deckCount === 52 && smoke.pingValid;

  return (
    <View style={styles.screen}>
      <Text style={styles.kicker}>Pokr</Text>
      <Text style={styles.title}>Mobile scaffold</Text>
      <Text style={styles.body}>
        Shared packages are {linked ? 'linked' : 'not linked'} on {Platform.OS}. A 52-card deck and
        the protocol ping message both resolve from the workspace builds.
      </Text>
      <View style={styles.card}>
        <Row label="Deck" value={String(smoke.deckCount)} />
        <Row label="Stakes" value={smoke.stakeIds.join(', ')} />
        <Row label="Ping" value={smoke.pingValid ? 'valid' : 'invalid'} />
        <Row label="API" value={API_URL} />
        <Row label="Socket" value={WS_URL} />
      </View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#14080f',
    paddingHorizontal: 24,
    paddingTop: 72,
    gap: 12,
  },
  kicker: {
    color: '#e8b4c8',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    color: '#fff7fb',
    fontSize: 34,
    fontWeight: '700',
  },
  body: {
    color: '#d7c4ce',
    fontSize: 16,
    lineHeight: 24,
  },
  card: {
    marginTop: 12,
    borderRadius: 16,
    backgroundColor: '#2a121c',
    padding: 16,
    gap: 10,
  },
  row: {
    gap: 2,
  },
  label: {
    color: '#e8b4c8',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  value: {
    color: '#fff7fb',
    fontSize: 15,
    lineHeight: 22,
  },
});
