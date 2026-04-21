import { useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { buildSession, SESSION_SIZE } from '@/lib/game';
import { getDeck } from '@/data/decks/index';
import type { GameCard, Subtheme } from '@/types/game';

type Answer = 'me' | 'you' | 'both';

const ANSWER_LABELS: Record<Answer, string> = {
  me: 'Moi',
  you: 'Toi',
  both: 'Les deux',
};

const SUBTHEME_LABELS: Record<Subtheme, string> = {
  playful: 'Complice',
  romantic: 'Romantique',
  chemistry: 'Chimie',
};

const SUBTHEME_COLORS: Record<Subtheme, { bg: string; text: string }> = {
  playful: { bg: '#F2CCB7', text: '#B85A3A' },
  romantic: { bg: '#FCEADE', text: '#C0533A' },
  chemistry: { bg: '#2B2D42', text: '#FFFDF9' },
};

const END_MESSAGES = [
  'Vous venez de vous découvrir un peu plus. ♥',
  'Dix cartes, mille nuances. Pas mal, vous deux.',
  'On dirait que vous vous connaissez bien. Ou peut-être pas si bien que ça ?',
  'Belle session. La prochaine sera encore plus surprenante.',
];

export default function PlayScreen() {
  const { deck: deckParam } = useLocalSearchParams<{ deck: string }>();
  const deckDef = getDeck(deckParam ?? '');

  const [session, setSession] = useState<GameCard[]>(() =>
    deckDef ? buildSession(deckDef.id) : []
  );
  const [index, setIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<Answer | null>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const [endMessage] = useState(
    () => END_MESSAGES[Math.floor(Math.random() * END_MESSAGES.length)]
  );

  if (!deckDef) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar style="dark" />
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Deck introuvable</Text>
          <Pressable
            style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
            onPress={() => router.back()}
            accessibilityRole="button"
          >
            <Text style={styles.ctaText}>Retour</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const sessionLength = Math.min(SESSION_SIZE, session.length);
  const isFinished = index >= sessionLength;
  const card = session[index];

  function handleAnswer(answer: Answer) {
    setSelectedAnswer(answer);
  }

  function handleNext() {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 140,
      useNativeDriver: true,
    }).start(() => {
      setIndex((i) => i + 1);
      setSelectedAnswer(null);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }).start();
    });
  }

  function handleRestart() {
    fadeAnim.setValue(0);
    setSession(buildSession(deckDef.id));
    setIndex(0);
    setSelectedAnswer(null);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }

  if (isFinished) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar style="dark" />
        <Animated.View style={[styles.endWrap, { opacity: fadeAnim }]}>
          <Text style={styles.endHeart}>♥</Text>
          <Text style={styles.endTitle}>Session terminée</Text>
          <Text style={styles.endMessage}>{endMessage}</Text>
          <View style={styles.endActions}>
            <Pressable
              style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
              onPress={handleRestart}
              accessibilityRole="button"
            >
              <Text style={styles.ctaText}>↺  Rejouer</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.secondary, pressed && styles.secondaryPressed]}
              onPress={() => router.back()}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryText}>Retour à votre espace</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    );
  }

  const subthemeStyle = SUBTHEME_COLORS[card.subtheme];

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="dark" />

      <View style={styles.topBar}>
        <Pressable
          style={styles.backBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
        >
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.progress}>
          Carte {index + 1} / {sessionLength}
        </Text>
        <View style={[styles.subthemeBadge, { backgroundColor: subthemeStyle.bg }]}>
          <Text style={[styles.subthemeText, { color: subthemeStyle.text }]}>
            {SUBTHEME_LABELS[card.subtheme]}
          </Text>
        </View>
      </View>

      <Animated.View style={[styles.cardWrap, { opacity: fadeAnim }]}>
        <View style={styles.card}>
          <Text style={styles.deckLabel}>{deckDef.title}</Text>
          <Text style={styles.prompt}>{card.prompt}</Text>
        </View>
      </Animated.View>

      <Animated.View style={[styles.actions, { opacity: fadeAnim }]}>
        {selectedAnswer ? (
          <>
            <View style={styles.answersRow}>
              {(['me', 'you', 'both'] as Answer[]).map((ans) => (
                <View
                  key={ans}
                  style={[
                    styles.answerChip,
                    selectedAnswer === ans ? styles.answerChipSelected : styles.answerChipFaded,
                  ]}
                >
                  <Text
                    style={[
                      styles.answerChipText,
                      selectedAnswer === ans && styles.answerChipTextSelected,
                    ]}
                  >
                    {ANSWER_LABELS[ans]}
                  </Text>
                </View>
              ))}
            </View>
            <Pressable
              style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
              onPress={handleNext}
              accessibilityRole="button"
            >
              <Text style={styles.ctaText}>
                {index + 1 < sessionLength ? 'Carte suivante →' : 'Voir le résultat'}
              </Text>
            </Pressable>
          </>
        ) : (
          <View style={styles.answersCol}>
            {(['me', 'you', 'both'] as Answer[]).map((ans) => (
              <Pressable
                key={ans}
                style={({ pressed }) => [styles.answerBtn, pressed && styles.answerBtnPressed]}
                onPress={() => handleAnswer(ans)}
                accessibilityRole="button"
              >
                <Text style={styles.answerBtnText}>{ANSWER_LABELS[ans]}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F9F6F0',
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 24,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2B2D42',
    textAlign: 'center',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: '#E9D8C8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    fontSize: 16,
    color: '#5C677D',
  },
  progress: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8D99AE',
    letterSpacing: 0.3,
  },
  subthemeBadge: {
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  subthemeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  cardWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#FFFDF9',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E9D8C8',
    padding: 32,
    shadowColor: '#C4A882',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 5,
    gap: 20,
    alignItems: 'center',
  },
  deckLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#C4A882',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  prompt: {
    fontSize: 23,
    fontWeight: '700',
    color: '#2B2D42',
    textAlign: 'center',
    lineHeight: 34,
  },
  actions: {
    gap: 12,
    paddingTop: 16,
  },
  answersCol: {
    gap: 10,
  },
  answerBtn: {
    backgroundColor: '#FFFDF9',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E9D8C8',
    paddingVertical: 16,
    alignItems: 'center',
  },
  answerBtnPressed: {
    backgroundColor: '#F2CCB7',
    borderColor: '#E07A5F',
  },
  answerBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2B2D42',
    letterSpacing: 0.2,
  },
  answersRow: {
    flexDirection: 'row',
    gap: 8,
  },
  answerChip: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  answerChipSelected: {
    backgroundColor: '#E07A5F',
    borderColor: '#E07A5F',
  },
  answerChipFaded: {
    backgroundColor: '#F9F6F0',
    borderColor: '#E9D8C8',
    opacity: 0.35,
  },
  answerChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8D99AE',
  },
  answerChipTextSelected: {
    color: '#FFFFFF',
  },
  cta: {
    backgroundColor: '#E07A5F',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#E07A5F',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  ctaPressed: {
    backgroundColor: '#D46A4C',
    shadowOpacity: 0.15,
    elevation: 2,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E9D8C8',
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryPressed: {
    backgroundColor: '#F2CCB7',
    borderColor: '#E07A5F',
  },
  secondaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#5C677D',
    letterSpacing: 0.2,
  },
  endWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 8,
  },
  endHeart: {
    fontSize: 52,
    marginBottom: 8,
  },
  endTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#2B2D42',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  endMessage: {
    fontSize: 16,
    color: '#5C677D',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 16,
  },
  endActions: {
    width: '100%',
    gap: 12,
  },
});
