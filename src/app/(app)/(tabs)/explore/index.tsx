import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { useI18n } from '@/i18n';

// Placeholder: social discovery (public playlists, people, search) is the LAST
// phase — the tab exists now so the bottom bar reads like Topper's from day
// one and the navigation structure doesn't shift under users later.
export default function ExploreScreen() {
  const { t } = useI18n();

  return (
    <Screen>
      <EmptyState
        emoji="🔭"
        title={t('explore.comingSoon.title')}
        subtitle={t('explore.comingSoon.subtitle')}
      />
    </Screen>
  );
}
