import { useEffect, useState } from 'react';

import {
  confirmDestructiveIos,
  ManageAccountScreen,
  ProgressOverlayIos,
} from '@portfolio/mobile-ui';
import { router, useNavigation } from 'expo-router';

import { HeaderCloseButton } from '@/components/ui/HeaderCloseButton';
import { SheetScreen } from '@/components/ui/SheetScreenIos';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useSnackbar } from '@/hooks/useSnackbar';
import { useI18n } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { deleteAccount } from '@/services/firebase/account';
import { useAuthStore } from '@/store/auth';
import { usePlayerStore } from '@/store/player';
import { useProfileStore } from '@/store/profile';

/**
 * Thin adapter over the shared `ManageAccountScreen` (the package resolves its
 * native SwiftUI `Form` twin — this screen used to hand-roll grouped rows out
 * of RN views, which read as an imitation of the real control). No `privacy`
 * section: this is a personal app with no social module. Only the delete
 * CONFIRMATION is platform-specific.
 *
 * ANDROID'S DIALOG BECOMES TWO ALERTS HERE, and Topper's account sheet is the
 * reference for why. A `UIAlertController` cannot disable, relabel or go busy,
 * so the friction iOS spends instead is two deliberate confirms back to back,
 * with CANCEL AS THE PREFERRED ACTION in both — the safe choice is the one iOS
 * draws prominently and the one a reflex tap lands on. That is Apple's own
 * treatment for a destructive alert, and it is where every destructive alert in
 * this app now comes from (`confirmDestructiveIos`).
 */

const formatMemberSince = (millis: number | null, locale: string) =>
  millis
    ? new Date(millis).toLocaleDateString(locale, {
        year: 'numeric',
        month: 'long',
      })
    : '—';

export default function ManageAccount() {
  const { t, locale } = useI18n();
  const { colors, scheme } = useAppTheme();
  const { showSnackbar } = useSnackbar();
  const user = useAuthStore(s => s.user);
  const profile = useProfileStore(s => s.profile);
  const hasSettled = useProfileStore(s => s.hasSettled);
  const navigation = useNavigation();

  /**
   * THE DELETE IS RUNNING, AND THE SHEET IS SEALED WHILE IT IS.
   *
   * Everything behind the second alert — the Cloudinary sweep, the Firestore
   * sweep, the Auth delete — used to run against a screen that looked idle and
   * stayed fully usable, for as long as all of that takes. Nothing said it was
   * happening and nothing stopped the reader navigating into Trophies, or
   * closing the sheet, while their account was being torn down under them.
   *
   * NOTHING RESETS IT ON SUCCESS, and that is deliberate rather than missing:
   * the auth listener redirects to Welcome the moment the auth user dies, so
   * the overlay stands until this screen is gone. Only the FAILURE path clears
   * it.
   */
  const [deleting, setDeleting] = useState(false);

  /**
   * THE TWO DISMISSALS THE OVERLAY CANNOT REACH. A form sheet's ✕ and its
   * grabber are UIKit chrome presented ABOVE this screen's content, so no view
   * rendered in here covers them — they have to be taken off the route itself.
   * Without this the sheet stays swipe-dismissible with the scrim on top of it.
   *
   * The grabber goes with them rather than staying as decoration: it is the
   * AFFORDANCE for a gesture that no longer works, and leaving it up is a
   * control that lies.
   *
   * BOTH BRANCHES STATED, because `setOptions` MERGES: a `headerRight` set only
   * while deleting would never be unset, and the ✕ would vanish on the first
   * run and stay gone for the sheet's life.
   */
  useEffect(() => {
    navigation.setOptions({
      gestureEnabled: !deleting,
      sheetGrabberVisible: !deleting,
      headerRight: deleting ? () => null : () => <HeaderCloseButton />,
    });
  }, [navigation, deleting]);

  /**
   * THE ROW SET IS THE SAME WHILE LOADING — three rows, values and all, with
   * `redacted` over them (see `ManageAccountScreen`'s `info.loading`). Name and
   * Email come off the auth object and are there on the first frame, while
   * Member Since waits on the Firestore profile, so the card would otherwise
   * grow under the reader as that row landed. It therefore stands its own
   * placeholder date rather than an em dash: the row has to occupy its final
   * height before the fact arrives. It still falls back to "—" once SETTLED
   * with no `createdAt`, because then the absence is the truth rather than a
   * wait.
   */
  const infoRows = [
    {
      label: t('settings.manageAccount.name'),
      value: user?.displayName ?? t('settings.account.noName'),
    },
    { label: t('settings.manageAccount.email'), value: user?.email ?? '—' },
    {
      label: t('settings.manageAccount.memberSince'),
      value: formatMemberSince(
        profile?.createdAt ?? (hasSettled ? null : Date.now()),
        locale,
      ),
    },
  ];

  const runDelete = async () => {
    haptics.medium();
    setDeleting(true);

    try {
      // Stop playback first — the engine would keep streaming a deleted song.
      usePlayerStore.getState().reset();
      await deleteAccount();
      // Auth listener notices the signed-out state and resets the app.
    } catch (error: unknown) {
      setDeleting(false);
      const code = (error as { code?: string })?.code ?? '';
      showSnackbar(
        t(
          code === 'auth/requires-recent-login'
            ? 'snackbar.delete-account-reauth'
            : 'snackbar.delete-account-failed',
        ),
      );
    }
  };

  // Same escalation order as Android: the full-consequences dialog first, then
  // the "last chance" confirm actually runs the delete.
  const confirmDelete = () => {
    if (deleting) return;

    haptics.selection();
    confirmDestructiveIos({
      title: t('settings.manageAccount.deleteDialog.title'),
      message: t('settings.manageAccount.deleteDialog.message'),
      cancelLabel: t('settings.manageAccount.deleteDialog.cancel'),
      confirmLabel: t('settings.manageAccount.deleteDialog.confirm'),
      onConfirm: () =>
        confirmDestructiveIos({
          title: t('settings.manageAccount.deleteDialog.confirmTitle'),
          message: t('settings.manageAccount.deleteDialog.confirmMessage'),
          cancelLabel: t('settings.manageAccount.deleteDialog.cancel'),
          confirmLabel: t('settings.manageAccount.deleteDialog.confirmCta'),
          onConfirm: () => void runDelete(),
        }),
    });
  };

  return (
    // `SheetScreen` for the toast, not for the surface: `ManageAccountScreen`
    // is a package screen and brings its own (colour-less) root. Wrapping it is
    // what lets a failed deletion's snackbar be SEEN — a sheet is presented
    // above the RN root, so the root's toast draws behind it.
    <SheetScreen>
      <ManageAccountScreen
        colors={colors}
        // The app's RESOLVED appearance, so the native Form follows an explicit
        // Light/Dark choice rather than the device trait — the same thing
        // Settings passes to its own Host.
        colorScheme={scheme}
        info={{
          title: t('settings.manageAccount.infoTitle'),
          rows: infoRows,
          loading: !hasSettled,
        }}
        // Trophies lives here on iOS: the home bar shows ONE identity glyph
        // (Apple's Apple Account pattern) and everything account-shaped sits
        // behind it. Untitled card — the label says what it is. Android keeps
        // Trophies in Settings and passes no `sections`.
        sections={[
          {
            rows: [
              {
                id: 'trophies',
                label: t('trophies.title'),
                icon: 'trophy',
                onPress: () => router.push('/trophies'),
              },
            ],
          },
        ]}
        danger={{
          title: t('settings.manageAccount.dangerTitle'),
          rowLabel: t('settings.manageAccount.deleteAccount'),
          // The card's FOOTER on iOS (Android sets it as the row's second
          // line) — Apple explains a destructive group beneath it rather than
          // heading it with the row's own words. See `ManageAccountScreen.ios`.
          rowDescription: t('settings.manageAccount.deleteAccountHint'),
          icon: 'delete-forever',
          onPress: confirmDelete,
          disabled: deleting,
        }}
      >
        {/* Mounted through the screen's own `children` slot — the same slot
            Android hangs its Compose dialog on. The two twins do the same job
            in their own language: Android's dialog stays up and goes busy,
            iOS's alert is Apple's and cannot, so the blocking lives here. */}
        <ProgressOverlayIos visible={deleting} />
      </ManageAccountScreen>
    </SheetScreen>
  );
}
