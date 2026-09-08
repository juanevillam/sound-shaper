export const translations = {
  en: {
    errors: {
      title: 'An Error Occurred',
      message: 'An unexpected error occurred.',
      retry: 'Try Again',
    },
    app: {
      title: 'Sound Shaper',
      settings: 'Settings',
      soundEdit: 'New Sound',
      soundEditExisting: 'Edit Sound',
    },
    common: {
      back: 'Back',
      cancel: 'Cancel',
      close: 'Close',
      // The snackbar's action-less dismiss slot (Android). It is the ONE
      // user-facing string that used to live outside this file, hardcoded
      // English in `SnackbarProvider`'s default.
      ok: 'OK',
      retry: 'Try Again',
      // ARTWORK, the voice table's word for a picture that stands for a
      // recording — and the same word this app's editor already uses. It read
      // "Choose an Emoji", carried over from Topper's item editor before that
      // app had a real picker, in an app that has never had an emoji feature.
      pickMedia: 'Choose Artwork',
    },
    welcome: {
      features: {
        library: {
          title: 'Your Sounds, Your Way',
          subtitle:
            'Upload the sounds you already have and play them your way.',
        },
        shape: {
          title: 'Shape the Sound',
          subtitle: 'Slow it down, speed it up, bend the pitch.',
        },
        clip: {
          title: 'Clip the Best Parts',
          subtitle: "Mark a sound's best seconds and jump right back to them.",
        },
      },
      button: {
        google: {
          label: 'Continue with Google',
          loadingLabel: 'Signing in…',
        },
        apple: {
          label: 'Continue with Apple',
          loadingLabel: 'Signing in…',
        },
      },
      legal: {
        text: "By continuing, you agree to Sound Shaper's {privacy} and {terms}.",
        privacy: 'Privacy Policy',
        terms: 'Terms and Conditions',
      },
    },
    home: {
      addSound: 'Add Sound',
      addSoundFormat: 'MP3 files only',
      error: {
        title: "Couldn't Load Your Sounds",
        subtitle: 'Check your connection and try again.',
      },
    },
    player: {
      title: 'Now Playing',
      empty: 'No Sounds Yet',
      play: 'Play',
      pause: 'Pause',
      next: 'Next Sound',
      previous: 'Previous Sound',
      speed: 'Playback Speed',
      keepPitch: 'Preserve Pitch',
      keepPitchDescription: 'Keeps the original pitch at any speed.',
      shape: {
        title: 'Shape',
        custom: 'Custom',
        none: 'None',
        pitchOff: 'pitch off',
        presets: 'Presets',
      },
      menu: {
        label: 'Sound Options',
        info: 'Get Info',
        edit: 'Edit Sound',
        // THE BAR'S LABEL, one word. `edit` above is the full phrase and stays
        // the compartment's accessibility label, where the extra word is worth
        // having; on the bar it is a card title beside "Shape" and "Clips" and
        // has to read as one of them.
        editShort: 'Edit',
      },
      info: {
        artist: 'Artist',
        album: 'Album',
        year: 'Release Year',
        none: 'This sound has no additional information.',
      },
      eq: {
        title: 'Equalizer',
        hint: 'Bass on the left, treble on the right',
        presets: {
          flat: 'Flat',
          bass: 'Bass',
          vocal: 'Vocal',
          treble: 'Treble',
          warm: 'Warm',
          bright: 'Bright',
        },
      },
      clips: {
        title: 'Clips',
        new: 'New Clip',
        edit: 'Edit Clip',
        editAction: 'Edit',
        preview: 'Preview',
        saveClip: 'Save',
        empty: 'Frame your favorite part above and save it.',
        none: 'No Clips Yet',
        // THE BAR'S SUMMARY, not the sheet's empty title. `none` above is an
        // empty-STATE title and was being used as a VALUE under the label
        // "Clips", where Apple writes one word — Settings says "Ringtone:
        // None". It also did not fit: 79.4pt of ink in an 86pt box, which
        // crowded the bar's trailing glyph.
        noneSummary: 'None',
        count: '{n} saved',
        // Names the glyph that marks the sounding row. COLOUR ALONE IS NOT AN
        // INDICATOR, so the accent is paired with a mark — and a mark needs a
        // name for anyone who cannot see it. Music does the same.
        playing: 'Now Playing',
        delete: 'Delete Clip',
        // A DIALOG, not an undo toast, and the reason is the container. A
        // snackbar fired from inside an open Compose `ModalBottomSheet` draws
        // BEHIND it — that sheet is its own window above the RN root, which is
        // what `SnackbarOutlet` exists to solve on iOS and what Android has no
        // outlet for. So the confirmation has to live in a window of its own,
        // which is exactly what the sound editor's delete already does one
        // sheet over.
        deleteConfirm: {
          title: 'Delete This Clip?',
          message: 'The clip will be deleted. This can’t be undone.',
          confirm: 'Delete',
          cancel: 'Cancel',
        },
        // VoiceOver only — the trim frame's three adjustable elements.
        selection: 'Clip',
        startHandle: 'Clip start',
        endHandle: 'Clip end',
        skipBack: 'Skip back 15 seconds',
        skipForward: 'Skip forward 15 seconds',
      },
    },
    soundEdit: {
      name: {
        label: 'Title',
        placeholder: 'Nightcall',
        error: 'Use at least 2 characters.',
      },
      subtitle: {
        label: 'Subtitle (Optional)',
        placeholder: 'Kavinsky',
      },
      art: {
        add: 'Add Artwork',
        change: 'Change Artwork',
        // Artwork is optional — a ringtone or a voice memo has none, and the
        // picture a file was shipped with is not one the person has to keep.
        remove: 'Remove Artwork',
      },
      uploading: 'Uploading sound…',
      save: 'Add',
      saveExisting: 'Save',
      delete: 'Delete Sound',
      deleteConfirm: {
        title: 'Delete This Sound?',
        message:
          'The sound and its file will be deleted. This can’t be undone.',
        confirm: 'Delete',
        cancel: 'Cancel',
      },
    },
    trophies: {
      title: 'Trophies',
      locked: 'Locked',
      earned: 'Earned',
      available: 'Available',
      unlocked: 'Trophy Unlocked',
      tier: {
        bronze: 'Bronze',
        silver: 'Silver',
        gold: 'Gold',
        platinum: 'Platinum',
      },
      items: {
        'first-sound': {
          description: 'Add your first sound.',
        },
        'first-shape': {
          description: 'Shape a sound — bend a band or change the speed.',
        },
        'first-clip': {
          description: 'Save your first clip.',
        },
        library: {
          description: 'Keep {count} sounds in your library.',
        },
        listening: {
          description: 'Listen for {count} minutes in total.',
        },
        'saved-clips': {
          description: 'Save {count} clips of your own.',
        },
        platinum: {
          description: 'Earn every other trophy.',
        },
      },
    },
    settings: {
      account: {
        title: 'Account',
        sheetTitle: 'Account',
        noName: 'Your Account',
        // The legend under the name on Settings' account banner — what is
        // behind the row, in Apple's construction (App Store: "Account info,
        // payments and settings"). Sentence case, no period: it is a
        // description, not a label.
        summary: 'Account info and trophies',
      },
      manageAccount: {
        title: 'Manage Account',
        infoTitle: 'Account Information',
        name: 'Name',
        email: 'Email',
        memberSince: 'Member Since',
        deleteAccount: 'Delete Account',
        deleteAccountHint: 'Your sounds and clips are deleted permanently.',
        deleteDialog: {
          title: 'Delete This Account?',
          message:
            'All of your sounds and clips will be deleted permanently. This can’t be undone.',
          confirm: 'Delete',
          cancel: 'Cancel',
          confirmTitle: 'Delete Account Permanently?',
          confirmMessage:
            'Your account and all of its data will be deleted permanently.',
          confirmCta: 'Delete Account',
        },
      },
      general: {
        title: 'General',
      },
      legal: {
        title: 'Legal',
      },
      language: {
        label: 'Language',
        en: 'English',
        es: 'Español',
        zh: '中文',
      },
      theme: {
        label: 'Appearance',
        light: 'Light',
        dark: 'Dark',
        system: 'Automatic',
      },
      cancel: 'Cancel',
      signOut: 'Sign Out',
      signOutDialog: {
        title: 'Sign Out?',
        message: "You'll need to sign in again to see your library.",
        cancel: 'Cancel',
        confirm: 'Sign Out',
      },
      about: {
        title: 'About',
        appVersion: 'Sound Shaper Version',
      },
    },
    snackbar: {
      'google-sign-in-failed': "Couldn't sign in with Google. Try again.",
      'apple-sign-in-failed': "Couldn't sign in with Apple. Try again.",
      'sign-out-failed': "Couldn't sign out. Try again.",
      'session-expired': 'Your session expired. Sign in again.',
      'sound-created': 'Sound added',
      'sound-updated': 'Sound updated',
      'sound-save-failed': "Couldn't save the sound. Try again.",
      'sound-deleted': 'Sound deleted',
      'sound-delete-failed': "Couldn't delete the sound. Try again.",
      'clip-created': 'Clip saved',
      'clip-updated': 'Clip updated',
      'clip-save-failed': "Couldn't save the clip. Try again.",
      'clip-deleted': 'Clip deleted',
      'clip-delete-failed': "Couldn't delete the clip. Try again.",
      'delete-account-failed': "Couldn't delete the account. Try again.",
      'delete-account-reauth':
        'Sign out, sign in again, and then try deleting.',
    },
  },
  es: {
    errors: {
      title: 'Se produjo un error',
      message: 'Se produjo un error inesperado.',
      retry: 'Reintentar',
    },
    app: {
      title: 'Sound Shaper',
      settings: 'Ajustes',
      soundEdit: 'Nuevo sonido',
      soundEditExisting: 'Editar sonido',
    },
    common: {
      back: 'Atrás',
      cancel: 'Cancelar',
      close: 'Cerrar',
      ok: 'OK',
      retry: 'Reintentar',
      pickMedia: 'Elegir ilustración',
    },
    welcome: {
      features: {
        library: {
          title: 'Tus sonidos, a tu manera',
          subtitle:
            'Sube los sonidos que ya tienes y reprodúcelos a tu manera.',
        },
        shape: {
          title: 'Moldea el sonido',
          subtitle: 'Ralentízalo, aceléralo, ajusta el tono.',
        },
        clip: {
          title: 'Recorta las mejores partes',
          subtitle:
            'Marca los mejores segundos de un sonido y vuelve a ellos al instante.',
        },
      },
      button: {
        google: {
          label: 'Continuar con Google',
          loadingLabel: 'Iniciando sesión…',
        },
        apple: {
          label: 'Continuar con Apple',
          loadingLabel: 'Iniciando sesión…',
        },
      },
      legal: {
        text: 'Al continuar, aceptas la {privacy} y los {terms} de Sound Shaper.',
        privacy: 'Política de Privacidad',
        terms: 'Términos y Condiciones',
      },
    },
    home: {
      addSound: 'Añadir sonido',
      addSoundFormat: 'Solo archivos MP3',
      error: {
        title: 'No se pudieron cargar tus sonidos',
        subtitle: 'Comprueba tu conexión y vuelve a intentarlo.',
      },
    },
    player: {
      title: 'Reproduciendo',
      empty: 'Aún no hay sonidos',
      play: 'Reproducir',
      pause: 'Pausa',
      next: 'Siguiente sonido',
      previous: 'Sonido anterior',
      speed: 'Velocidad de reproducción',
      keepPitch: 'Conservar el tono',
      keepPitchDescription: 'Conserva el tono original a cualquier velocidad.',
      shape: {
        title: 'Moldear',
        custom: 'Personalizado',
        none: 'Ninguno',
        pitchOff: 'tono libre',
        presets: 'Ajustes preestablecidos',
      },
      menu: {
        label: 'Opciones del sonido',
        info: 'Obtener información',
        edit: 'Editar sonido',
        editShort: 'Editar',
      },
      info: {
        artist: 'Artista',
        album: 'Álbum',
        year: 'Año de lanzamiento',
        none: 'Este sonido no tiene información adicional.',
      },
      eq: {
        title: 'Ecualizador',
        hint: 'Graves a la izquierda, agudos a la derecha',
        presets: {
          flat: 'Plano',
          bass: 'Graves',
          vocal: 'Voz',
          treble: 'Agudos',
          warm: 'Cálido',
          bright: 'Brillante',
        },
      },
      clips: {
        title: 'Clips',
        new: 'Nuevo clip',
        edit: 'Editar clip',
        editAction: 'Editar',
        preview: 'Previsualizar',
        saveClip: 'Guardar',
        empty: 'Encuadra tu parte favorita arriba y guárdala.',
        none: 'Aún no hay clips',
        noneSummary: 'Ninguno',
        count: '{n} guardados',
        playing: 'Reproduciendo',
        delete: 'Eliminar clip',
        deleteConfirm: {
          title: '¿Eliminar este clip?',
          message: 'El clip se eliminará. Esta acción no se puede deshacer.',
          confirm: 'Eliminar',
          cancel: 'Cancelar',
        },
        selection: 'Clip',
        startHandle: 'Inicio del clip',
        endHandle: 'Fin del clip',
        skipBack: 'Retroceder 15 segundos',
        skipForward: 'Avanzar 15 segundos',
      },
    },
    soundEdit: {
      name: {
        label: 'Título',
        placeholder: 'Nightcall',
        error: 'Usa al menos 2 caracteres.',
      },
      subtitle: {
        label: 'Subtítulo (opcional)',
        placeholder: 'Kavinsky',
      },
      art: {
        add: 'Añadir ilustración',
        change: 'Cambiar ilustración',
        remove: 'Quitar ilustración',
      },
      uploading: 'Subiendo el sonido…',
      save: 'Añadir',
      saveExisting: 'Guardar',
      delete: 'Eliminar sonido',
      deleteConfirm: {
        title: '¿Eliminar este sonido?',
        message:
          'El sonido y su archivo se eliminarán. Esta acción no se puede deshacer.',
        confirm: 'Eliminar',
        cancel: 'Cancelar',
      },
    },
    trophies: {
      title: 'Trofeos',
      locked: 'Bloqueado',
      earned: 'Conseguido',
      available: 'Disponibles',
      unlocked: 'Trofeo desbloqueado',
      tier: {
        bronze: 'Bronce',
        silver: 'Plata',
        gold: 'Oro',
        platinum: 'Platino',
      },
      items: {
        'first-sound': {
          description: 'Añade tu primer sonido.',
        },
        'first-shape': {
          description:
            'Moldea un sonido: ajusta una banda o cambia la velocidad.',
        },
        'first-clip': {
          description: 'Guarda tu primer clip.',
        },
        library: {
          description: 'Ten {count} sonidos en tu biblioteca.',
        },
        listening: {
          description: 'Escucha {count} minutos en total.',
        },
        'saved-clips': {
          description: 'Guarda {count} clips propios.',
        },
        platinum: {
          description: 'Consigue todos los demás trofeos.',
        },
      },
    },
    settings: {
      account: {
        title: 'Cuenta',
        sheetTitle: 'Cuenta',
        noName: 'Tu cuenta',
        summary: 'Información de la cuenta y trofeos',
      },
      manageAccount: {
        title: 'Gestionar cuenta',
        infoTitle: 'Información de la cuenta',
        name: 'Nombre',
        email: 'Correo electrónico',
        memberSince: 'Miembro desde',
        deleteAccount: 'Eliminar cuenta',
        deleteAccountHint: 'Tus sonidos y clips se eliminan permanentemente.',
        deleteDialog: {
          title: '¿Eliminar esta cuenta?',
          message:
            'Todos tus sonidos y clips se eliminarán permanentemente. Esta acción no se puede deshacer.',
          confirm: 'Eliminar',
          cancel: 'Cancelar',
          confirmTitle: '¿Eliminar la cuenta permanentemente?',
          confirmMessage:
            'Tu cuenta y todos sus datos se eliminarán permanentemente.',
          confirmCta: 'Eliminar cuenta',
        },
      },
      general: {
        title: 'General',
      },
      legal: {
        title: 'Legal',
      },
      language: {
        label: 'Idioma',
        en: 'English',
        es: 'Español',
        zh: '中文',
      },
      theme: {
        label: 'Apariencia',
        light: 'Claro',
        dark: 'Oscuro',
        system: 'Automático',
      },
      cancel: 'Cancelar',
      signOut: 'Cerrar sesión',
      signOutDialog: {
        title: '¿Cerrar sesión?',
        message: 'Tendrás que iniciar sesión de nuevo para ver tu biblioteca.',
        cancel: 'Cancelar',
        confirm: 'Cerrar sesión',
      },
      about: {
        title: 'Acerca de',
        appVersion: 'Versión de Sound Shaper',
      },
    },
    snackbar: {
      'google-sign-in-failed':
        'No se pudo iniciar sesión con Google. Vuelve a intentarlo.',
      'apple-sign-in-failed':
        'No se pudo iniciar sesión con Apple. Vuelve a intentarlo.',
      'sign-out-failed': 'No se pudo cerrar sesión. Vuelve a intentarlo.',
      'session-expired': 'Tu sesión expiró. Inicia sesión de nuevo.',
      'sound-created': 'Sonido añadido',
      'sound-updated': 'Sonido actualizado',
      'sound-save-failed': 'No se pudo guardar el sonido. Vuelve a intentarlo.',
      'sound-deleted': 'Sonido eliminado',
      'sound-delete-failed':
        'No se pudo eliminar el sonido. Vuelve a intentarlo.',
      'clip-created': 'Clip guardado',
      'clip-updated': 'Clip actualizado',
      'clip-save-failed': 'No se pudo guardar el clip. Vuelve a intentarlo.',
      'clip-deleted': 'Clip eliminado',
      'clip-delete-failed': 'No se pudo eliminar el clip. Vuelve a intentarlo.',
      'delete-account-failed':
        'No se pudo eliminar la cuenta. Vuelve a intentarlo.',
      'delete-account-reauth':
        'Cierra sesión, vuelve a iniciarla e inténtalo de nuevo.',
    },
  },
  zh: {
    errors: {
      title: '发生错误',
      message: '发生了意外错误。',
      retry: '重试',
    },
    app: {
      title: 'Sound Shaper',
      settings: '设置',
      soundEdit: '新建音频',
      soundEditExisting: '编辑音频',
    },
    common: {
      back: '返回',
      cancel: '取消',
      close: '关闭',
      ok: '好',
      retry: '重试',
      pickMedia: '选择插图',
    },
    welcome: {
      features: {
        library: {
          title: '你的音频，随你所愿',
          subtitle: '上传你已有的音频，按你喜欢的方式播放。',
        },
        shape: {
          title: '塑造声音',
          subtitle: '放慢、加速、调整音高。',
        },
        clip: {
          title: '剪辑最精彩的部分',
          subtitle: '标记一段音频最精彩的几秒，随时回到那里。',
        },
      },
      button: {
        google: {
          label: '使用 Google 继续',
          loadingLabel: '正在登录…',
        },
        apple: {
          label: '通过 Apple 继续',
          loadingLabel: '正在登录…',
        },
      },
      legal: {
        text: '继续即表示你同意 Sound Shaper 的{privacy}和{terms}。',
        privacy: '隐私政策',
        terms: '条款与条件',
      },
    },
    home: {
      addSound: '添加音频',
      addSoundFormat: '仅限 MP3 文件',
      error: {
        title: '无法载入你的音频',
        subtitle: '请检查网络连接后重试。',
      },
    },
    player: {
      title: '正在播放',
      empty: '还没有音频',
      play: '播放',
      pause: '暂停',
      next: '下一个音频',
      previous: '上一个音频',
      speed: '播放速度',
      keepPitch: '保持音高',
      keepPitchDescription: '在任何速度下都保持原始音高。',
      shape: {
        title: '塑形',
        custom: '自定',
        none: '无',
        pitchOff: '不保持音高',
        presets: '预置',
      },
      menu: {
        label: '音频选项',
        info: '显示简介',
        edit: '编辑音频',
        editShort: '编辑',
      },
      info: {
        artist: '艺人',
        album: '专辑',
        year: '发行年份',
        none: '此音频没有其他信息。',
      },
      eq: {
        title: '均衡器',
        hint: '左侧低音，右侧高音',
        presets: {
          flat: '平坦',
          bass: '低音',
          vocal: '人声',
          treble: '高音',
          warm: '温暖',
          bright: '明亮',
        },
      },
      clips: {
        title: '片段',
        new: '新建片段',
        edit: '编辑片段',
        editAction: '编辑',
        preview: '预览',
        saveClip: '存储',
        empty: '在上方框选你最喜欢的部分并存储。',
        none: '还没有片段',
        noneSummary: '无',
        count: '已存储 {n} 个',
        playing: '正在播放',
        delete: '删除片段',
        deleteConfirm: {
          title: '删除此片段？',
          message: '此片段将被删除。此操作无法撤销。',
          confirm: '删除',
          cancel: '取消',
        },
        selection: '片段',
        startHandle: '片段起点',
        endHandle: '片段终点',
        skipBack: '后退15秒',
        skipForward: '前进15秒',
      },
    },
    soundEdit: {
      name: {
        label: '标题',
        placeholder: 'Nightcall',
        error: '请至少输入 2 个字符。',
      },
      subtitle: {
        label: '副标题（可选）',
        placeholder: 'Kavinsky',
      },
      art: {
        add: '添加插图',
        change: '更换插图',
        remove: '移除插图',
      },
      uploading: '正在上传音频…',
      save: '添加',
      saveExisting: '存储',
      delete: '删除音频',
      deleteConfirm: {
        title: '删除此音频？',
        message: '此音频及其文件将被删除。此操作无法撤销。',
        confirm: '删除',
        cancel: '取消',
      },
    },
    trophies: {
      title: '奖杯',
      locked: '未解锁',
      earned: '已获得',
      available: '可获得',
      unlocked: '奖杯已解锁',
      tier: {
        bronze: '青铜',
        silver: '白银',
        gold: '黄金',
        platinum: '白金',
      },
      items: {
        'first-sound': {
          description: '添加你的第一个音频。',
        },
        'first-shape': {
          description: '塑造一个音频：调整频段或速度。',
        },
        'first-clip': {
          description: '存储你的第一个片段。',
        },
        library: {
          description: '让音频库中保有 {count} 个音频。',
        },
        listening: {
          description: '累计聆听 {count} 分钟。',
        },
        'saved-clips': {
          description: '存储 {count} 个你自己的片段。',
        },
        platinum: {
          description: '获得其他所有奖杯。',
        },
      },
    },
    settings: {
      account: {
        title: '账户',
        sheetTitle: '账户',
        noName: '你的账户',
        summary: '账户信息和奖杯',
      },
      manageAccount: {
        title: '管理账户',
        infoTitle: '账户信息',
        name: '姓名',
        email: '电子邮件',
        memberSince: '注册时间',
        deleteAccount: '删除账户',
        deleteAccountHint: '你的音频和片段将被永久删除。',
        deleteDialog: {
          title: '删除此账户？',
          message: '你的所有音频和片段将被永久删除。此操作无法撤销。',
          confirm: '删除',
          cancel: '取消',
          confirmTitle: '永久删除账户？',
          confirmMessage: '你的账户及其所有数据将被永久删除。',
          confirmCta: '删除账户',
        },
      },
      general: {
        title: '通用',
      },
      legal: {
        title: '法律信息',
      },
      language: {
        label: '语言',
        en: 'English',
        es: 'Español',
        zh: '中文',
      },
      theme: {
        label: '外观',
        light: '浅色',
        dark: '深色',
        system: '自动',
      },
      cancel: '取消',
      signOut: '退出登录',
      signOutDialog: {
        title: '退出登录？',
        message: '你需要重新登录才能查看你的音频库。',
        cancel: '取消',
        confirm: '退出登录',
      },
      about: {
        title: '关于',
        appVersion: 'Sound Shaper 版本',
      },
    },
    snackbar: {
      'google-sign-in-failed': '无法使用 Google 登录。请再试一次。',
      'apple-sign-in-failed': '无法通过 Apple 登录。请再试一次。',
      'sign-out-failed': '无法退出登录。请再试一次。',
      'session-expired': '你的会话已过期。请重新登录。',
      'sound-created': '音频已添加',
      'sound-updated': '音频已更新',
      'sound-save-failed': '无法存储音频。请再试一次。',
      'sound-deleted': '音频已删除',
      'sound-delete-failed': '无法删除音频。请再试一次。',
      'clip-created': '片段已存储',
      'clip-updated': '片段已更新',
      'clip-save-failed': '无法存储片段。请再试一次。',
      'clip-deleted': '片段已删除',
      'clip-delete-failed': '无法删除片段。请再试一次。',
      'delete-account-failed': '无法删除账户。请再试一次。',
      'delete-account-reauth': '请退出登录后重新登录，然后再尝试删除。',
    },
  },
} as const;

export type Locale = keyof typeof translations;
export const SUPPORTED_LOCALES: Locale[] = ['en', 'es', 'zh'];
