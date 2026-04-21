import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { ensureAnonymousSession } from '@/lib/auth';
import { getMyCouple } from '@/lib/couple';

type Screen = 'boot' | 'home' | 'loading' | 'generated' | 'error';

interface GeneratedInvite {
  code: string;
  invite_id: string;
  expires_at: string;
}

function formatExpiry(expiresAt: string): string {
  const mins = Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 60_000));
  return mins <= 1 ? "moins d'1 min" : `${mins} min`;
}

export default function HomeScreen() {
  const [screen, setScreen] = useState<Screen>('boot');
  const [invite, setInvite] = useState<GeneratedInvite | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    async function bootstrap() {
      try {
        await ensureAnonymousSession();
        const couple = await getMyCouple();
        if (couple) {
          router.replace('/couple');
          return;
        }
      } catch {
        // session error — on affiche quand même l'accueil
      }
      setScreen('home');
    }
    bootstrap();
  }, []);

  async function callGenerate() {
    setScreen('loading');
    setErrorMsg('');
    try {
      await ensureAnonymousSession();
      const { data, error } = await supabase.rpc('create_couple_invite');
      if (error) throw error;
      setInvite(data as GeneratedInvite);
      setScreen('generated');
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? '';
      setErrorMsg(
        msg === 'user_already_in_couple'
          ? "Tu fais déjà partie d'un couple. Impossible de générer un nouveau code."
          : 'Impossible de générer un code. Vérifie ta connexion et réessaie.'
      );
      setScreen('error');
    }
  }

  function handleBack() {
    setScreen('home');
    setInvite(null);
    setErrorMsg('');
  }

  // ── Boot ───────────────────────────────────────────────────────────────────
  if (screen === 'boot') {
    return (
      <View style={[styles.screen, styles.centered]}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#E07A5F" />
      </View>
    );
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (screen === 'loading') {
    return (
      <View style={[styles.screen, styles.centered]}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#E07A5F" />
        <Text style={styles.loadingText}>Génération en cours…</Text>
      </View>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (screen === 'error') {
    return (
      <View style={styles.screen}>
        <StatusBar style="dark" />
        <View style={[styles.header, styles.centered, { flex: 1 }]}>
          <Text style={styles.title}>Une erreur est survenue</Text>
          <Text style={styles.subtitle}>{errorMsg}</Text>
        </View>
        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
            onPress={callGenerate}
          >
            <Text style={styles.ctaText}>Réessayer</Text>
          </Pressable>
          <Pressable onPress={handleBack}>
            <Text style={styles.backLink}>← Retour à l'accueil</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Generated ──────────────────────────────────────────────────────────────
  if (screen === 'generated' && invite) {
    return (
      <View style={styles.screen}>
        <StatusBar style="dark" />

        <View style={styles.header}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>♥  Votre code de couple</Text>
          </View>
          <Text style={styles.title}>Votre lien est prêt</Text>
          <Text style={styles.subtitle}>
            Partagez ce code avec votre partenaire{'\n'}pour synchroniser vos appareils.
          </Text>
        </View>

        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>CODE DE COUPLE</Text>
          <Text style={styles.codeValue}>{invite.code}</Text>
          <View style={styles.codeDivider} />
          <Text style={styles.codeHint}>
            Expire dans {formatExpiry(invite.expires_at)}
          </Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
            onPress={callGenerate}
            accessibilityRole="button"
          >
            <Text style={styles.ctaText}>↻  Régénérer un code</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.secondary, pressed && styles.secondaryPressed]}
            onPress={() => router.push('/join')}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryText}>J'ai déjà un code</Text>
          </Pressable>

          <Pressable onPress={handleBack}>
            <Text style={styles.backLink}>← Retour à l'accueil</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Home ───────────────────────────────────────────────────────────────────
  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>♥  Votre espace à deux</Text>
        </View>
        <Text style={styles.title}>Bloomy Clone</Text>
        <Text style={styles.subtitle}>
          Connectez vos deux téléphones{'\n'}et partagez chaque instant.
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardRow}>
          <View style={styles.dot} />
          <Text style={styles.cardLabel}>Comment ça marche ?</Text>
        </View>

        <View style={styles.step}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>1</Text>
          </View>
          <Text style={styles.stepText}>Générez un code unique sur votre téléphone.</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.step}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>2</Text>
          </View>
          <Text style={styles.stepText}>Partagez-le avec votre partenaire.</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.step}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>3</Text>
          </View>
          <Text style={styles.stepText}>Vos deux appareils sont synchronisés.</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          onPress={callGenerate}
          accessibilityRole="button"
        >
          <Text style={styles.ctaText}>Générer mon code de couple</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.secondary, pressed && styles.secondaryPressed]}
          onPress={() => router.push('/join')}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryText}>J'ai déjà un code</Text>
        </Pressable>

        <Text style={styles.footer}>Gratuit · Sécurisé · Instantané</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F9F6F0',
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
    justifyContent: 'space-between',
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 15,
    color: '#5C677D',
  },

  // En-tête
  header: {
    alignItems: 'center',
    gap: 14,
  },
  badge: {
    backgroundColor: '#F2CCB7',
    borderRadius: 50,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E07A5F',
    letterSpacing: 0.6,
  },
  title: {
    fontSize: 38,
    fontWeight: '800',
    color: '#2B2D42',
    textAlign: 'center',
    letterSpacing: 0.3,
    lineHeight: 46,
  },
  subtitle: {
    fontSize: 16,
    color: '#5C677D',
    textAlign: 'center',
    lineHeight: 26,
  },

  // Card "comment ça marche"
  card: {
    flex: 1,
    backgroundColor: '#FFFDF9',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E9D8C8',
    padding: 24,
    marginVertical: 28,
    shadowColor: '#C4A882',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 3,
    justifyContent: 'center',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E07A5F',
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8D99AE',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    paddingVertical: 14,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#F2CCB7',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepNumberText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E07A5F',
  },
  stepText: {
    flex: 1,
    fontSize: 15,
    color: '#2B2D42',
    lineHeight: 22,
    paddingTop: 3,
  },
  divider: {
    height: 1,
    backgroundColor: '#E9D8C8',
    marginLeft: 44,
  },

  // Card "code généré"
  codeCard: {
    flex: 1,
    backgroundColor: '#FFFDF9',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E9D8C8',
    padding: 32,
    marginVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#C4A882',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 3,
    gap: 16,
  },
  codeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8D99AE',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  codeValue: {
    fontSize: 56,
    fontWeight: '800',
    color: '#E07A5F',
    letterSpacing: 6,
    textAlign: 'center',
  },
  codeDivider: {
    width: 48,
    height: 2,
    backgroundColor: '#E9D8C8',
    borderRadius: 2,
  },
  codeHint: {
    fontSize: 13,
    color: '#8D99AE',
    textAlign: 'center',
    lineHeight: 20,
  },

  // Actions
  actions: {
    gap: 12,
  },
  cta: {
    backgroundColor: '#E07A5F',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#E07A5F',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
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
    backgroundColor: '#FFFDF9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E9D8C8',
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryPressed: {
    backgroundColor: '#F9F6F0',
  },
  secondaryText: {
    color: '#5C677D',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  backLink: {
    textAlign: 'center',
    fontSize: 13,
    color: '#8D99AE',
    paddingVertical: 4,
  },
  footer: {
    textAlign: 'center',
    fontSize: 12,
    color: '#8D99AE',
    letterSpacing: 0.6,
    marginTop: 4,
  },
});
