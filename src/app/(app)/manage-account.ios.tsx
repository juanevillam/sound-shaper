import { useEffect, useState } from 'react';

import {
  confirmDestructiveIos,
  ManageAccountScreen,
  ProgressOverlayIos,
} from '@portfolio/mobile-ui';
import { router, useNavigation } from 'expo-router';

import { HeaderCloseButton } from '@/components/ui/HeaderCloseButton';
import { SheetScreen } from '@/components/ui/SheetScreenIos';
import { isGuardedAccountRun } from '@/dev/deleteAccountGuard';
import { UI_STATE_LAB, useUiStateLab } from '@/dev/uiStateLab';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useDeleteAccount } from '@/hooks/useDeleteAccount';
import { useSnackbar } from '@/hooks/useSnackbar';
import { useI18n } from '@/i18n';
import { haptics } from '@/lib/haptics';
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
 * ANDROID'S DIALOG BECOMES THREE THINGS HERE, and none of them is a timer. A
 * `UIAlertController` cannot disable, relabel or go busy, so a countdown would
 * need a hand-built dialog — the one thing this repo's rules forbid drawing.
 * What iOS spends instead:
 *
 *  - TWO deliberate confirms back to back, the platform's friction idiom.
 *  - CANCEL AS THE PREFERRED ACTION in both, so the safe choice is the one iOS
 *    draws prominently and the one a reflex tap lands on. That is Apple's own
 *    treatment for a destructive alert, and where every destructive alert in
 *    this app now comes from (`confirmDestructiveIos`).
 *  - RE-AUTHENTICATION as the pipeline's FIRST step (`useDeleteAccount`): the
 *    provider's own sheet, before anything is touched, and a dismissal aborts
 *    with everything intact. Apple escalates a consequential action by asking
 *    who you are, not by making you wait.
 *
 * The two twins are siblings, not clones: Android waits, iOS asks.
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
  const deleteAccount = useDeleteAccount();

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
   * DEV LAB — applied to the values the route already derives, so the branch
   * that renders is the real one.
   */
  const accountLab = useUiStateLab(state => state.account);
  const lab = UI_STATE_LAB && accountLab !== 'live';

  const loading = lab ? accountLab === 'skeleton' : !hasSettled;
  // Pinnable because it cannot be reached by hand — see `AccountState`.
  const showDeleting = lab ? accountLab === 'deleting' : deleting;

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
      gestureEnabled: !showDeleting,
      sheetGrabberVisible: !showDeleting,
      headerRight: showDeleting ? () => null : () => <HeaderCloseButton />,
    });
  }, [navigation, showDeleting]);

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
        profile?.createdAt ?? (loading ? Date.now() : null),
        locale,
      ),
    },
  ];

  const runDelete = async () => {
    // DEV GUARD — see `dev/deleteAccountGuard`. Refused before the pipeline's
    // FIRST step, which re-authenticates against the provider; the two alerts
    // above it stay reachable, since they are what there is to review.
    if (isGuardedAccountRun()) return;

    haptics.medium();
    setDeleting(true);

    try {
      // Stop playback first — the engine would keep streaming a deleted sound.
      usePlayerStore.getState().reset();
      await deleteAccount();
      // Auth listener notices the signed-out state and resets the app.
    } catch (error: unknown) {
      setDeleting(false);

      /**
       * A DISMISSED RE-AUTH SHEET IS NOT A FAILURE, and it is the common exit
       * from here — the pipeline's first step is the provider's own sheet, and
       * backing out of it is how someone changes their mind. Nothing has been
       * touched at that point, so it says nothing; the overlay lifting IS the
       * feedback.
       */
      if ((error as { message?: string })?.message === 'reauth-cancelled')
        return;

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
    <SheetScreen screen="account">
      <ManageAccountScreen
        colors={colors}
        // The app's RESOLVED appearance, so the native Form follows an explicit
        // Light/Dark choice rather than the device trait — the same thing
        // Settings passes to its own Host.
        colorScheme={scheme}
        info={{
          title: t('settings.manageAccount.infoTitle'),
          rows: infoRows,
          loading,
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
          disabled: showDeleting,
        }}
      >
        {/* Mounted through the screen's own `children` slot — the same slot
            Android hangs its Compose dialog on. The two twins do the same job
            in their own language: Android's dialog stays up and goes busy,
            iOS's alert is Apple's and cannot, so the blocking lives here. */}
        <ProgressOverlayIos visible={showDeleting} />
      </ManageAccountScreen>
    </SheetScreen>
  );
}
