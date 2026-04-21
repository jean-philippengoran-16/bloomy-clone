import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { ensureAnonymousSession } from '@/lib/auth';
import { getMyCouple, type Couple } from '@/lib/couple';
import { getMyLastCheckIn, saveCheckIn, MOODS, type CheckIn, type Mood } from '@/lib/checkin';
import { DECK_ORDER, DECK_REGISTRY } from '@/data/decks/index';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatRelative(iso: string): string {
  const diffMins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (diffMins < 1) return "à l'instant";
  if (diffMins < 60) return `il y a ${diffMins} min`;
  const diffH = Math.floor(diffMins / 60);
  if (diffH < 24) return `il y a ${diffH}h`;
  if (diffH < 48) return 'hier';
  return formatDate(iso);
}

export default function CoupleScreen() {
  const [couple, setCouple] = useState<Couple | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMood, setSelectedMood] = useState<Mood | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [lastCheckIn, setLastCheckIn] = useState<CheckIn | null>(null);

  useEffect(() => {
    async function load() {
      try {
        await ensureAnonymousSession();
        const c = await getMyCouple();
        setCouple(c);
        if (c) {
          const last = await getMyLastCheckIn(c.id);
          setLastCheckIn(last);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSave() {
    if (!couple || !selectedMood) return;
    setSaving(true);
    try {
      await saveCheckIn(couple.id, selectedMood, note);
      const last = await getMyLastCheckIn(couple.id);
      setLastCheckIn(last);
      setDone(true);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setSelectedMood(null);
    setNote('');
    setDone(false);
  }

  if (loading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#E07A5F" />
      </View>
    );
  }

  if (!couple) {
    return (
      <View style={styles.screen}>
        <StatusBar style="dark" />
        <View style={[styles.centered, { flex: 1 }]}>
          <Text style={styles.title}>Aucun couple trouvé</Text>
          <Text style={styles.subtitle}>
            Il semblerait que vous ne soyez pas encore connecté à un partenaire.
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          onPress={() => router.replace('/')}
          accessibilityRole="button"
        >
          <Text style={styles.ctaText}>Retour à l'accueil</Text>
        </Pressable>
      </View>
    );
  }

  const featuredDeck = DECK_REGISTRY[DECK_ORDER[0]];
  const gridDecks = DECK_ORDER.slice(1).map((id) => DECK_REGISTRY[id]);

  function getDeckActionLabel(deckId: string): string {
    return deckId === 'connection_v1' ? 'Ouvrir →' : 'Jouer →';
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <StatusBar style="dark" />

        {/* En-tête */}
        <View style={styles.header}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>♥  Vous êtes connectés</Text>
          </View>
          <Text style={styles.title}>Bonjour, vous deux</Text>
        </View>

        {/* ── Section Jouer ensemble ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>JOUER ENSEMBLE</Text>

          {/* Deck principal — jouable */}
          <Pressable
            style={({ pressed }) => [
              styles.featuredCard,
              pressed && styles.featuredCardPressed,
            ]}
            onPress={() => router.push(`/play/${featuredDeck.id}`)}
            accessibilityRole="button"
          >
            <View style={styles.featuredTop}>
              <View style={styles.featuredBadge}>
                <Text style={styles.featuredBadgeText}>
                  {featuredDeck.subtitle.toUpperCase()}
                </Text>
              </View>
              <Text style={styles.featuredTitle}>{featuredDeck.title}</Text>
              <Text style={styles.featuredDesc}>{featuredDeck.description}</Text>
            </View>
            <View style={styles.featuredCta}>
              <Text style={styles.featuredCtaText}>Lancer une session →</Text>
            </View>
          </Pressable>

          {/* Grille des decks — 2 colonnes */}
          <View style={styles.deckGrid}>
            {[gridDecks.slice(0, 2), gridDecks.slice(2, 4)].map((row, rowIdx) => (
              <View key={rowIdx} style={styles.deckRow}>
                {row.map((deck) =>
                  deck.available ? (
                    <Pressable
                      key={deck.id}
                      style={({ pressed }) => [
                        styles.deckTile,
                        styles.deckTileActive,
                        pressed && styles.deckTileActivePressed,
                      ]}
                      onPress={() => router.push(`/play/${deck.id}`)}
                      accessibilityRole="button"
                    >
                      <Text style={styles.deckTileTitle}>{deck.title}</Text>
                      <View style={styles.activeBadge}>
                        <Text style={styles.activeText}>{getDeckActionLabel(deck.id)}</Text>
                      </View>
                      <Text style={styles.deckTileDesc} numberOfLines={2}>
                        {deck.description}
                      </Text>
                    </Pressable>
                  ) : (
                    <View key={deck.id} style={styles.deckTile}>
                      <Text style={styles.deckTileTitle}>{deck.title}</Text>
                      <View style={styles.soonBadge}>
                        <Text style={styles.soonText}>Bientôt</Text>
                      </View>
                      <Text style={styles.deckTileDesc} numberOfLines={2}>
                        {deck.description}
                      </Text>
                    </View>
                  )
                )}
              </View>
            ))}
          </View>
        </View>

        {/* ── Check-in du jour ── */}
        <View style={styles.card}>
          {done ? (
            <View style={styles.doneWrap}>
              <Text style={styles.doneEmoji}>{selectedMood}</Text>
              <Text style={styles.doneTitle}>Check-in enregistré</Text>
              {note.trim() ? (
                <Text style={styles.doneNote}>"{note.trim()}"</Text>
              ) : null}
              <Pressable onPress={handleReset} accessibilityRole="button">
                <Text style={styles.resetLink}>Faire un autre check-in</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={styles.cardTitle}>Comment tu te sens aujourd'hui ?</Text>
              <View style={styles.moodRow}>
                {MOODS.map((m) => (
                  <Pressable
                    key={m}
                    style={[styles.moodBtn, selectedMood === m && styles.moodBtnActive]}
                    onPress={() => setSelectedMood(m)}
                    accessibilityRole="button"
                  >
                    <Text style={styles.moodEmoji}>{m}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                style={styles.noteInput}
                value={note}
                onChangeText={setNote}
                placeholder="Un mot doux… (facultatif)"
                placeholderTextColor="#8D99AE"
                multiline
                maxLength={120}
              />
              <Pressable
                style={({ pressed }) => [
                  styles.cta,
                  (!selectedMood || saving) && styles.ctaDisabled,
                  pressed && !!selectedMood && !saving && styles.ctaPressed,
                ]}
                onPress={handleSave}
                disabled={!selectedMood || saving}
                accessibilityRole="button"
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.ctaText}>Enregistrer</Text>
                )}
              </Pressable>
            </>
          )}
        </View>

        {/* Dernier check-in */}
        {lastCheckIn && !done && (
          <View style={styles.lastCard}>
            <Text style={styles.lastLabel}>TON DERNIER CHECK-IN</Text>
            <View style={styles.lastRow}>
              <Text style={styles.lastEmoji}>{lastCheckIn.mood}</Text>
              <View style={styles.lastMeta}>
                {lastCheckIn.note ? (
                  <Text style={styles.lastNote}>"{lastCheckIn.note}"</Text>
                ) : null}
                <Text style={styles.lastDate}>{formatRelative(lastCheckIn.created_at)}</Text>
              </View>
            </View>
          </View>
        )}

        <Text style={styles.footer}>Ensemble depuis {formatDate(couple.created_at)}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: '#F9F6F0',
  },
  screen: {
    flex: 1,
    backgroundColor: '#F9F6F0',
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
    justifyContent: 'space-between',
  },
  scroll: {
    flex: 1,
    backgroundColor: '#F9F6F0',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 48,
    gap: 20,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },

  // En-tête
  header: {
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  badge: {
    backgroundColor: '#E8F5E9',
    borderRadius: 50,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7BAE7F',
    letterSpacing: 0.6,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: '#2B2D42',
    textAlign: 'center',
    letterSpacing: 0.3,
    lineHeight: 42,
  },
  subtitle: {
    fontSize: 15,
    color: '#5C677D',
    textAlign: 'center',
    lineHeight: 24,
  },

  // Section Jouer ensemble
  section: {
    gap: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8D99AE',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },

  // Deck principal (featured)
  featuredCard: {
    backgroundColor: '#2B2D42',
    borderRadius: 20,
    padding: 24,
    gap: 20,
    shadowColor: '#2B2D42',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 6,
  },
  featuredCardPressed: {
    opacity: 0.9,
  },
  featuredTop: {
    gap: 10,
  },
  featuredBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  featuredBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#F2CCB7',
    letterSpacing: 1.2,
  },
  featuredTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFDF9',
    letterSpacing: 0.3,
    lineHeight: 32,
  },
  featuredDesc: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 22,
  },
  featuredCta: {
    backgroundColor: '#E07A5F',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#E07A5F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  featuredCtaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Grille des decks à venir
  deckGrid: {
    gap: 10,
  },
  deckRow: {
    flexDirection: 'row',
    gap: 10,
  },
  deckTile: {
    flex: 1,
    backgroundColor: '#FFFDF9',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E9D8C8',
    padding: 16,
    gap: 8,
  },
  deckTileTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2B2D42',
    lineHeight: 20,
  },
  deckTileActive: {
    borderColor: '#E07A5F',
    borderWidth: 1.5,
  },
  deckTileActivePressed: {
    backgroundColor: '#FDF0EA',
  },
  activeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E07A5F',
    borderRadius: 20,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  activeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.6,
  },
  soonBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F2CCB7',
    borderRadius: 20,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  soonText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B85A3A',
    letterSpacing: 0.6,
  },
  deckTileDesc: {
    fontSize: 11,
    color: '#8D99AE',
    lineHeight: 16,
  },

  // Card check-in
  card: {
    backgroundColor: '#FFFDF9',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E9D8C8',
    padding: 24,
    shadowColor: '#C4A882',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 3,
    gap: 16,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#2B2D42',
    textAlign: 'center',
  },
  moodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  moodBtn: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#F9F6F0',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  moodBtnActive: {
    backgroundColor: '#F2CCB7',
    borderColor: '#E07A5F',
  },
  moodEmoji: {
    fontSize: 28,
  },
  noteInput: {
    backgroundColor: '#F9F6F0',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E9D8C8',
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#2B2D42',
    minHeight: 60,
    textAlignVertical: 'top',
  },

  // CTA partagé
  cta: {
    backgroundColor: '#E07A5F',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#E07A5F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  ctaPressed: {
    backgroundColor: '#D46A4C',
    shadowOpacity: 0.15,
    elevation: 2,
  },
  ctaDisabled: {
    opacity: 0.45,
    shadowOpacity: 0,
    elevation: 0,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // État done
  doneWrap: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  doneEmoji: {
    fontSize: 48,
  },
  doneTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#2B2D42',
  },
  doneNote: {
    fontSize: 14,
    color: '#5C677D',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  resetLink: {
    fontSize: 13,
    color: '#E07A5F',
    fontWeight: '600',
    marginTop: 4,
  },

  // Dernier check-in
  lastCard: {
    backgroundColor: '#FFFDF9',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E9D8C8',
    padding: 20,
    gap: 12,
  },
  lastLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8D99AE',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  lastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  lastEmoji: {
    fontSize: 36,
  },
  lastMeta: {
    flex: 1,
    gap: 4,
  },
  lastNote: {
    fontSize: 14,
    color: '#2B2D42',
    fontStyle: 'italic',
  },
  lastDate: {
    fontSize: 12,
    color: '#8D99AE',
  },

  // Pied de page
  footer: {
    textAlign: 'center',
    fontSize: 12,
    color: '#C4A882',
    letterSpacing: 0.4,
    marginTop: 8,
  },
});
