import { Redirect, Stack } from 'expo-router';
import { Text, View } from 'react-native';
import { DECK_ORDER, DECK_REGISTRY } from '@/data/decks/index';

export default function LegacyPlayRedirect() {
  const firstAvailableDeck = DECK_ORDER.find((id) => DECK_REGISTRY[id].available);

  if (!firstAvailableDeck) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#F9F6F0',
          paddingHorizontal: 24,
        }}
      >
        <Stack.Screen options={{ headerShown: false }} />
        <Text
          style={{
            color: '#2B2D42',
            fontSize: 18,
            fontWeight: '700',
            textAlign: 'center',
          }}
        >
          Aucun deck disponible
        </Text>
      </View>
    );
  }

  return <Redirect href={{ pathname: '/play/[deck]', params: { deck: firstAvailableDeck } }} />;
}
