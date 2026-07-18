import { useState } from 'react';

import { ScrollView, StyleSheet, View } from 'react-native';

import {
  Column,
  RNHostView,
  Row,
  Shape,
  Surface,
  Text,
} from '@expo/ui/jetpack-compose';
import {
  fillMaxWidth,
  padding,
  width as widthModifier,
} from '@expo/ui/jetpack-compose/modifiers';
import { UsernameDialog } from '@portfolio/mobile-ui';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PlaylistCard } from '@/components/playlists/PlaylistCard';
import { Avatar } from '@/components/ui/Avatar';
import { Screen } from '@/components/ui/Screen';
import { Text as AppText } from '@/components/ui/Text';
import { ThemedHost } from '@/components/ui/ThemedHost';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useHeaderScroll } from '@/hooks/useHeaderScroll';
import { useUsernameEditor } from '@/hooks/useUsernameEditor';
import { useI18n } from '@/i18n';
import { useAuthStore } from '@/store/auth';
import { usePlaylistsStore } from '@/store/playlists';
import { useProfileStore } from '@/store/profile';

const AVATAR_SIZE = 80;
const STAT_WIDTH = 84;
const CARD_GAP = 12;
const SCROLL_THROTTLE_MS = 64;

const NAME_SHAPE = Shape.RoundedCorner({
  cornerRadii: {
    topStart: 12,
    topEnd: 12,
    bottomStart: 12,
    bottomEnd: 12,
  },
});

// Your own profile: identity block (avatar, name, claim-username prompt, the
// playlist count) above your playlists. The social half (followers /
// following / public profiles) arrives with the Explore phase — the header's
// layout mirrors Topper's ProfileHeader so those stats can slot in beside the
// count without a redesign.
export default function ProfileTab() {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const user = useAuthStore(s => s.user);
  const profile = useProfileStore(s => s.profile);
  const playlists = usePlaylistsStore(s => s.playlists);
  const { onScroll } = useHeaderScroll();
  const usernameEditor = useUsernameEditor();
  const [usernameDialogVisible, setUsernameDialogVisible] = useState(false);

  const name =
    profile?.displayName ?? user?.displayName ?? profile?.username ?? '';
  const playlistCount = playlists.length;

  return (
    <Screen>
      <SafeAreaView style={styles.safeArea} edges={[]}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          onScroll={onScroll}
          scrollEventThrottle={SCROLL_THROTTLE_MS}
        >
          {/* Identity block — one Compose Host matching its content
              vertically, with the avatar bridged back to RN via RNHostView
              (Compose has no remote-image component). */}
          <ThemedHost matchContents={{ vertical: true }} style={styles.host}>
            <Column
              horizontalAlignment="center"
              verticalArrangement={{ spacedBy: 8 }}
              modifiers={[fillMaxWidth(), padding(16, 24, 16, 8)]}
            >
              <RNHostView matchContents>
                <Avatar
                  name={name}
                  photoUrl={user?.photoUrl ?? null}
                  size={AVATAR_SIZE}
                />
              </RNHostView>

              <Column
                horizontalAlignment="center"
                verticalArrangement={{ spacedBy: 6 }}
                modifiers={[padding(0, 6, 0, 0)]}
              >
                <Text
                  color={colors.onSurface}
                  style={{ typography: 'titleLarge' }}
                >
                  {name}
                </Text>
                {profile?.username ? (
                  <Text
                    color={colors.onSurfaceMuted}
                    style={{ typography: 'bodyMedium' }}
                  >
                    {`@${profile.username}`}
                  </Text>
                ) : (
                  // Reads as a link, so it IS one: opens the claim dialog on a
                  // ripple Surface for a real touch target.
                  <Surface
                    onClick={() => setUsernameDialogVisible(true)}
                    color="transparent"
                    shape={NAME_SHAPE}
                  >
                    <Text
                      color={colors.primary}
                      style={{ typography: 'bodyMedium' }}
                      modifiers={[padding(12, 6, 12, 6)]}
                    >
                      {t('profile.addUsername')}
                    </Text>
                  </Surface>
                )}
              </Column>

              <Row horizontalArrangement={{ spacedBy: 16 }}>
                <Column
                  horizontalAlignment="center"
                  verticalArrangement={{ spacedBy: 2 }}
                  modifiers={[widthModifier(STAT_WIDTH), padding(0, 4, 0, 4)]}
                >
                  <Text
                    color={colors.onSurface}
                    style={{ typography: 'titleMedium' }}
                  >
                    {String(playlistCount)}
                  </Text>
                  <Text
                    color={colors.onSurfaceMuted}
                    style={{ typography: 'labelMedium' }}
                  >
                    {t(
                      playlistCount === 1
                        ? 'profile.playlistOne'
                        : 'profile.playlists',
                    )}
                  </Text>
                </Column>
              </Row>
            </Column>
          </ThemedHost>

          {/* Your playlists, same cards as Home (tap opens; management lives
              on Home's long-press + the detail overflow). */}
          {playlistCount === 0 ? (
            <View style={styles.empty}>
              <AppText
                muted
                text="profile.empty.subtitle"
                variant="bodyMedium"
                style={styles.emptyText}
              />
            </View>
          ) : (
            <View style={styles.list}>
              {playlists.map(playlist => (
                <PlaylistCard
                  key={playlist.id}
                  playlist={playlist}
                  onPress={() =>
                    router.push({
                      pathname: '/playlist-detail',
                      params: { playlistId: playlist.id },
                    })
                  }
                />
              ))}
            </View>
          )}
        </ScrollView>

        {/* Claim-username dialog (own Host — dialogs corrupt siblings). */}
        {usernameDialogVisible && (
          <ThemedHost matchContents>
            <UsernameDialog
              editor={usernameEditor}
              colors={colors}
              onDismiss={() => setUsernameDialogVisible(false)}
            />
          </ThemedHost>
        )}
      </SafeAreaView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 16 },
  host: { width: '100%' },
  list: {
    gap: CARD_GAP,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  empty: { paddingHorizontal: 24, paddingTop: 24 },
  emptyText: { textAlign: 'center' },
});
