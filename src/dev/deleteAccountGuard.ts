import { UI_STATE_LAB } from '@/dev/uiStateLab';

/**
 * DEV GUARD — refuses to run the real account deletion while the state lab is
 * on.
 *
 * Deleting the account is the ONE action in this app that cannot be undone or
 * tried a second time: it sweeps the Cloudinary media, sweeps Firestore and
 * destroys the Auth user. The lab exists so that flow's states can be STEPPED
 * (see `AccountState`'s `deleting`), which means the destructive row is being
 * tapped repeatedly while it is on — and one of those taps landing on the real
 * pipeline costs a whole test account.
 *
 * So the flag that makes the state pinnable is the same flag that disarms the
 * thing it stands for. Both confirmation alerts stay reachable, because they
 * are what there is to review; only the pipeline behind them is refused.
 *
 * Turn `STATE_LAB` off in `dev/flags.ts` to delete an account for real.
 */
export const isGuardedAccountRun = () => {
  if (!UI_STATE_LAB) return false;

  console.warn(
    '[dev] Delete Account refused: STATE_LAB is on. Turn it off in dev/flags.ts to run the real deletion.',
  );

  return true;
};
