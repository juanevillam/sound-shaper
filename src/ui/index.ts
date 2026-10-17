/**
 * THE MODULE'S PUBLIC API — what the rest of the app imports from `@/ui`.
 * Components consumed only INSIDE `src/ui` (TextLink, AnimatedEntrance,
 * SettingsAccountSection, the shared screens' prop types…) are deliberately
 * not exported; re-add one the day something outside imports it. Note when
 * auditing: a few exports here (the single-source terms such as
 * `LIST_ROW_ONE_LINE` or `FormDisclosureRowIos`) are today read only inside
 * `src/ui` through relative imports, so a symbol's barrel line is not proof
 * it has an outside consumer.
 */
export { AppIcon } from './AppIcon';
export {
  CARD_RADIUS,
  CONTINUOUS_CURVE,
  HAIRLINE,
  innerRadius,
  SHAPE_MD,
  SHAPE_SM,
  TILE_RADIUS,
} from './shape';
export { legalUrl, type LegalPage } from './author';
export { confirmDestructiveIos } from './confirmDestructiveIos';
export { DisclosureChevron } from './DisclosureChevron';
export { DestructiveConfirmDialog } from './DestructiveConfirmDialog';
export { artworkRadius } from './artworkRadius';
export { EmptyState, EMPTY_STATE_STEPS } from './EmptyState';
export { HeaderIconButton } from './HeaderIconButton';
export {
  EMPTY_MEDIA_CAPTION_GAP,
  EMPTY_MEDIA_PLUS,
  emptyMediaPlusStyle,
} from './emptyMedia';
export {
  MediaPickerAvatar,
  MEDIA_PICKER_SIZE,
  mediaPickerSlotHeight,
  type MediaPickerAvatarProps,
} from './MediaPickerAvatar';
export {
  MINI_PLAYER_HEIGHT,
  NOW_PLAYING_BOTTOM_GAP_IOS,
} from './nowPlayingBanner';
export { ErrorScreen } from './ErrorScreen';
export {
  HEADER_CLOSE_GLYPH_SIZE,
  HEADER_LONE_TARGET,
  HeaderGlyphButtonIos,
  HeaderGlyphGroupIos,
} from './HeaderGlyphButtonIos';
export {
  FormDisclosureIndicatorIos,
  FormDisclosureRowIos,
  FormValueRowIos,
} from './FormDisclosureRowIos';
export {
  GROUPED_ROW,
  GROUPED_ROW_PITCH,
  LIST_ROW_PADDING_VERTICAL,
} from './groupedRow';
export { LIST_ROW_ONE_LINE } from './listRowText';
export { SHEET_HERO_BADGE_SIZE, SHEET_HERO_GLYPH_SIZE } from './sheetHero';
export {
  composeSheetBottomPadding,
  COMPOSE_SHEET_GUTTER,
  COMPOSE_SHEET_HEADER_HEIGHT,
  COMPOSE_SHEET_HEADER_TO_CONTENT,
  SHEET_CONTENT_TOP,
  SHEET_EMPTY_HEADER_SLOT,
  SHEET_FIRST_CARD_MARGIN,
} from './sheetMetrics';
export { SkeletonBone } from './SkeletonBone';
export { SkeletonTextLine, SKELETON_BAR_RATIO } from './SkeletonTextLine';
export { SettingsDialog } from './SettingsDialog';
export { StateWrap } from './StateWrap';
export {
  EMPTY_MEDIA_INITIAL_RATIO,
  emptyMediaColor,
  InitialArt,
  type MediaContainer,
} from './InitialArt';
export { iconSource, preloadIcons, type IconName } from './icons';
export { WelcomeScreen, type AuthAction } from './WelcomeScreen';
export { ProgressOverlayIos } from './ProgressOverlayIos';
export { ProgressViewIos } from './ProgressViewIos';
export { Screen } from './Screen';
export { SheetBar } from './SheetBar';
export { SheetErrorLine } from './SheetErrorLine';
export { useSnackbar } from './snackbar';
export {
  FLOATING_COPY_GAP,
  FLOATING_EDGE_GAP,
  FLOATING_RADIUS,
} from './floating';
export {
  GLASS_FLOOR,
  glassFloorColor,
  GlassSurfaceIos,
  makeGlassUnderlay,
} from './GlassSurfaceIos';
export { SnackbarOutlet } from './SnackbarOutlet';
export { SnackbarProvider } from './SnackbarProvider';
export {
  ICON_PRESS_OPACITY,
  ICON_PRESS_SCALE,
  PRESSED_OPACITY,
  SquashPressable,
  usePressSquash,
} from './SquashPressable';
export { StateLab, type StateLabGroup } from './StateLab';
export { SwiftUIHost } from './SwiftUIHost';
export { useBackdropThumbhash } from './useBackdropThumbhash';
export { useNavigationTheme } from './useNavigationTheme';
export { createText, TEXT_VARIANTS, type TextVariant } from './createText';
export {
  actionButtonModifiersIos,
  sheetCommitBarOptionsIos,
  SheetFormBodyIos,
  SheetFormDestructiveIos,
  SheetFormFieldIos,
  SheetFormMediaIos,
} from './SheetFormIos';
export { SHEET_DRAG_HANDLE, SheetDragHandle } from './SheetDragHandle';
export { SheetBarAction } from './SheetBar';
export {
  dialogContainer,
  GROUP_INNER_RADIUS,
  GROUP_OUTER_RADIUS,
  GROUP_ROW_GAP,
  GROUP_SIDE_PADDING,
  groupRowShape,
  menuContainer,
  SCREEN_CONTENT_TOP,
  sheetContainer,
} from './settingsGroup';
export {
  UsernameDialog,
  type SettingsAccountProfile,
  type SettingsUsernameEditor,
} from './SettingsAccountSection';
export { ManageAccountScreen } from './ManageAccountScreen';
export { SettingsScreen } from './SettingsScreen';
export {
  buildAboutSettingsSection,
  buildGeneralSettingsSections,
} from './settingsContent';
export { setSplashHidden } from './useSplashHidden';
export * from './tokens';
export { useSheetLanded } from './useSheetLanded';
export { useHeaderScroll } from './useHeaderScroll';
export { DRAG_ACTIVE_SCALE } from './dragMetrics';
