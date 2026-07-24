export const translations = {
  en: {
    errors: {
      title: 'Something went wrong',
      message: 'An unexpected error occurred.',
      retry: 'Try again',
    },
    app: {
      title: 'Sound Shaper',
      settings: 'Settings',
      songEdit: 'New sound',
      songEditExisting: 'Edit sound',
    },
    common: {
      back: 'Back',
      cancel: 'Cancel',
      retry: 'Try again',
      pickMedia: 'Choose an emoji',
    },
    welcome: {
      features: {
        library: {
          title: 'Your sounds, your way',
          subtitle:
            'Upload the sounds you already have and play them your way.',
        },
        shape: {
          title: 'Shape the sound',
          subtitle: 'Slow it down, speed it up, bend the pitch.',
        },
        clip: {
          title: 'Clip the best parts',
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
        terms: 'Terms & Conditions',
      },
    },
    home: {
      addSong: 'Add sound',
      sort: {
        label: 'Sort sounds',
        recent: 'Recently added',
        oldest: 'Oldest first',
        title: 'Title',
        artist: 'Artist',
      },
      error: {
        title: 'Could not load your sounds',
        subtitle: 'Check your connection and try again.',
      },
    },
    player: {
      title: 'Now playing',
      empty: 'There are no sounds yet',
      play: 'Play',
      pause: 'Pause',
      next: 'Next sound',
      previous: 'Previous sound',
      speed: 'Speed',
      keepPitch: 'Keep pitch',
      keepPitchDescription: 'Hold the original tone while the speed changes.',
      shape: {
        title: 'Shape',
        custom: 'Custom',
        pitchOff: 'pitch off',
      },
      shapes: {
        save: 'Save',
        saveTitle: 'Save this shape',
        nameLabel: 'Name',
        delete: 'Delete shape',
      },
      menu: {
        label: 'Sound options',
        info: 'Sound info',
        edit: 'Edit sound',
      },
      info: {
        artist: 'Artist',
        album: 'Album',
        year: 'Release year',
        none: 'This sound has no extra details.',
      },
      eq: {
        title: 'Equalizer',
        reset: 'Flat',
        preamp: 'Preamp',
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
        new: 'New clip',
        preview: 'Preview',
        saveClip: 'Save',
        empty: 'Frame your favorite part above and save it.',
        none: 'No clips yet',
        count: '{n} saved',
        delete: 'Delete clip',
      },
    },
    songEdit: {
      name: {
        label: 'Title',
        placeholder: 'Nightcall',
        error: 'Title needs at least 2 characters',
      },
      artist: {
        label: 'Artist (optional)',
        placeholder: 'Kavinsky',
      },
      album: {
        label: 'Album (optional)',
        placeholder: 'OutRun',
      },
      year: {
        label: 'Release year (optional)',
        placeholder: '2010',
        error: 'Enter a valid year',
      },
      art: {
        embedded: 'Cover art from the file',
        none: 'This file has no cover art',
      },
      uploading: 'Uploading sound…',
      save: 'Add',
      saveExisting: 'Save',
      delete: 'Delete sound',
      deleteConfirm: {
        title: 'Delete this sound?',
        message:
          'The sound and its file will be removed. This cannot be undone.',
        confirm: 'Delete',
        cancel: 'Cancel',
      },
    },
    settings: {
      account: {
        title: 'Account',
        noName: 'Your account',
      },
      manageAccount: {
        title: 'Manage account',
        infoTitle: 'Account info',
        name: 'Name',
        email: 'Email',
        memberSince: 'Member since',
        dangerTitle: 'Danger zone',
        deleteAccount: 'Delete account',
        deleteAccountHint: 'Your sounds and clips are removed permanently.',
        deleteDialog: {
          title: 'Delete this account?',
          message:
            'All your sounds and clips will be permanently deleted. This cannot be undone.',
          confirm: 'Delete',
          cancel: 'Cancel',
        },
      },
      general: {
        title: 'General',
      },
      language: {
        label: 'Language',
        en: 'English',
        es: 'Español',
        zh: '中文',
      },
      theme: {
        label: 'Theme',
        light: 'Light',
        dark: 'Dark',
        system: 'System',
      },
      cancel: 'Cancel',
      signOut: 'Log out',
      signOutDialog: {
        title: 'Log out?',
        message: "You'll need to sign in again to access your library.",
        cancel: 'Cancel',
        confirm: 'Log out',
      },
      about: {
        title: 'About',
        appVersion: 'Sound Shaper version',
        expoUiVersion: 'Expo UI version',
      },
    },
    snackbar: {
      'google-sign-in-failed': 'Google sign-in failed. Please try again.',
      'apple-sign-in-failed': 'Apple sign-in failed. Please try again.',
      'sign-out-failed': 'Could not log out. Please try again.',
      'session-expired': 'Your session expired. Please sign in again.',
      'song-created': 'Sound added',
      'song-updated': 'Sound updated',
      'song-save-failed': 'Could not save the sound. Please try again.',
      'song-deleted': 'Sound deleted',
      'song-delete-failed': 'Could not delete the sound. Please try again.',
      'clip-created': 'Clip saved',
      'clip-save-failed': 'Could not save the clip. Please try again.',
      'clip-deleted': 'Clip deleted',
      'clip-delete-failed': 'Could not delete the clip. Please try again.',
      'shape-created': 'Shape saved',
      'shape-save-failed': 'Could not save the shape. Please try again.',
      'shape-deleted': 'Shape deleted',
      'shape-delete-failed': 'Could not delete the shape. Please try again.',
      'delete-account-failed':
        'Could not delete the account. Please try again.',
      'delete-account-reauth':
        'Please log out, sign in again, and retry deleting.',
    },
  },
  es: {
    errors: {
      title: 'Algo salió mal',
      message: 'Ocurrió un error inesperado.',
      retry: 'Reintentar',
    },
    app: {
      title: 'Sound Shaper',
      settings: 'Configuración',
      songEdit: 'Nuevo sonido',
      songEditExisting: 'Editar sonido',
    },
    common: {
      back: 'Atrás',
      cancel: 'Cancelar',
      retry: 'Reintentar',
      pickMedia: 'Elegir un emoji',
    },
    welcome: {
      features: {
        library: {
          title: 'Tus sonidos, a tu manera',
          subtitle:
            'Sube los sonidos que ya tienes y reprodúcelos a tu manera.',
        },
        shape: {
          title: 'Modela el sonido',
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
      addSong: 'Agregar sonido',
      sort: {
        label: 'Ordenar sonidos',
        recent: 'Agregadas recientemente',
        oldest: 'Más antiguas primero',
        title: 'Título',
        artist: 'Artista',
      },
      error: {
        title: 'No se pudieron cargar tus sonidos',
        subtitle: 'Revisa tu conexión e inténtalo de nuevo.',
      },
    },
    player: {
      title: 'Reproduciendo',
      empty: 'Aún no hay sonidos',
      play: 'Reproducir',
      pause: 'Pausar',
      next: 'Siguiente sonido',
      previous: 'Sonido anterior',
      speed: 'Velocidad',
      keepPitch: 'Mantener el tono',
      keepPitchDescription:
        'Conserva el tono original mientras cambia la velocidad.',
      shape: {
        title: 'Moldear',
        custom: 'Personalizado',
        pitchOff: 'tono libre',
      },
      shapes: {
        save: 'Guardar',
        saveTitle: 'Guardar este ajuste',
        nameLabel: 'Nombre',
        delete: 'Eliminar ajuste',
      },
      menu: {
        label: 'Opciones del sonido',
        info: 'Información',
        edit: 'Editar sonido',
      },
      info: {
        artist: 'Artista',
        album: 'Álbum',
        year: 'Año de lanzamiento',
        none: 'Este sonido no tiene más detalles.',
      },
      eq: {
        title: 'Ecualizador',
        reset: 'Plano',
        preamp: 'Preamp',
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
        preview: 'Escuchar',
        saveClip: 'Guardar',
        empty: 'Encuadra tu parte favorita arriba y guárdala.',
        none: 'Aún no hay clips',
        count: '{n} guardados',
        delete: 'Eliminar clip',
      },
    },
    songEdit: {
      name: {
        label: 'Título',
        placeholder: 'Nightcall',
        error: 'El título necesita al menos 2 caracteres',
      },
      artist: {
        label: 'Artista (opcional)',
        placeholder: 'Kavinsky',
      },
      album: {
        label: 'Álbum (opcional)',
        placeholder: 'OutRun',
      },
      year: {
        label: 'Año de lanzamiento (opcional)',
        placeholder: '2010',
        error: 'Ingresa un año válido',
      },
      art: {
        embedded: 'Carátula tomada del archivo',
        none: 'Este archivo no tiene carátula',
      },
      uploading: 'Subiendo sonido…',
      save: 'Agregar',
      saveExisting: 'Guardar',
      delete: 'Eliminar sonido',
      deleteConfirm: {
        title: '¿Eliminar este sonido?',
        message:
          'El sonido y su archivo se eliminarán. Esto no se puede deshacer.',
        confirm: 'Eliminar',
        cancel: 'Cancelar',
      },
    },
    settings: {
      account: {
        title: 'Cuenta',
        noName: 'Tu cuenta',
      },
      manageAccount: {
        title: 'Gestionar cuenta',
        infoTitle: 'Información de la cuenta',
        name: 'Nombre',
        email: 'Correo',
        memberSince: 'Miembro desde',
        dangerTitle: 'Zona de riesgo',
        deleteAccount: 'Eliminar cuenta',
        deleteAccountHint: 'Tus sonidos y clips se eliminan permanentemente.',
        deleteDialog: {
          title: '¿Eliminar esta cuenta?',
          message:
            'Todos tus sonidos y clips se eliminarán permanentemente. Esto no se puede deshacer.',
          confirm: 'Eliminar',
          cancel: 'Cancelar',
        },
      },
      general: {
        title: 'General',
      },
      language: {
        label: 'Idioma',
        en: 'English',
        es: 'Español',
        zh: '中文',
      },
      theme: {
        label: 'Tema',
        light: 'Claro',
        dark: 'Oscuro',
        system: 'Sistema',
      },
      cancel: 'Cancelar',
      signOut: 'Cerrar sesión',
      signOutDialog: {
        title: '¿Cerrar sesión?',
        message:
          'Tendrás que iniciar sesión de nuevo para acceder a tu biblioteca.',
        cancel: 'Cancelar',
        confirm: 'Cerrar sesión',
      },
      about: {
        title: 'Acerca de',
        appVersion: 'Versión de Sound Shaper',
        expoUiVersion: 'Versión de Expo UI',
      },
    },
    snackbar: {
      'google-sign-in-failed':
        'Falló el inicio de sesión con Google. Inténtalo de nuevo.',
      'apple-sign-in-failed':
        'Falló el inicio de sesión con Apple. Inténtalo de nuevo.',
      'sign-out-failed': 'No se pudo cerrar sesión. Inténtalo de nuevo.',
      'session-expired': 'Tu sesión expiró. Inicia sesión de nuevo.',
      'song-created': 'Sonido agregado',
      'song-updated': 'Sonido actualizado',
      'song-save-failed': 'No se pudo guardar el sonido. Inténtalo de nuevo.',
      'song-deleted': 'Sonido eliminado',
      'song-delete-failed':
        'No se pudo eliminar el sonido. Inténtalo de nuevo.',
      'clip-created': 'Clip guardado',
      'clip-save-failed': 'No se pudo guardar el clip. Inténtalo de nuevo.',
      'clip-deleted': 'Clip eliminado',
      'clip-delete-failed': 'No se pudo eliminar el clip. Inténtalo de nuevo.',
      'shape-created': 'Ajuste guardado',
      'shape-save-failed': 'No se pudo guardar el ajuste. Inténtalo de nuevo.',
      'shape-deleted': 'Ajuste eliminado',
      'shape-delete-failed':
        'No se pudo eliminar el ajuste. Inténtalo de nuevo.',
      'delete-account-failed':
        'No se pudo eliminar la cuenta. Inténtalo de nuevo.',
      'delete-account-reauth':
        'Cierra sesión, vuelve a iniciarla e inténtalo de nuevo.',
    },
  },
  zh: {
    errors: {
      title: '出错了',
      message: '发生了意外错误。',
      retry: '重试',
    },
    app: {
      title: 'Sound Shaper',
      settings: '设置',
      songEdit: '新建音频',
      songEditExisting: '编辑音频',
    },
    common: {
      back: '返回',
      cancel: '取消',
      retry: '重试',
      pickMedia: '选择表情符号',
    },
    welcome: {
      features: {
        library: {
          title: '你的音频，随你所愿',
          subtitle: '上传你已有的曲目，按你喜欢的方式播放。',
        },
        shape: {
          title: '塑造声音',
          subtitle: '放慢、加速、调整音高。',
        },
        clip: {
          title: '剪辑最精彩的部分',
          subtitle: '标记一首歌最精彩的几秒，随时回到那里。',
        },
      },
      button: {
        google: {
          label: '使用 Google 继续',
          loadingLabel: '正在登录…',
        },
        apple: {
          label: '使用 Apple 继续',
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
      addSong: '添加音频',
      sort: {
        label: '音频排序',
        recent: '最近添加',
        oldest: '最早添加',
        title: '标题',
        artist: '艺术家',
      },
      error: {
        title: '无法加载你的音频',
        subtitle: '请检查网络连接后重试。',
      },
    },
    player: {
      title: '正在播放',
      empty: '还没有音频',
      play: '播放',
      pause: '暂停',
      next: '下一首',
      previous: '上一首',
      speed: '速度',
      keepPitch: '保持音调',
      keepPitchDescription: '改变速度时保持原来的音调。',
      shape: {
        title: '塑形',
        custom: '自定义',
        pitchOff: '不保持音调',
      },
      shapes: {
        save: '保存',
        saveTitle: '保存此设置',
        nameLabel: '名称',
        delete: '删除设置',
      },
      menu: {
        label: '音频选项',
        info: '音频信息',
        edit: '编辑音频',
      },
      info: {
        artist: '艺术家',
        album: '专辑',
        year: '发行年份',
        none: '这首歌没有更多信息。',
      },
      eq: {
        title: '均衡器',
        reset: '平坦',
        preamp: '前置放大',
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
        new: '新片段',
        preview: '试听',
        saveClip: '保存',
        empty: '在上方框选你最喜欢的部分并保存。',
        none: '还没有片段',
        count: '已存 {n} 个',
        delete: '删除片段',
      },
    },
    songEdit: {
      name: {
        label: '标题',
        placeholder: 'Nightcall',
        error: '标题至少需要 2 个字符',
      },
      artist: {
        label: '艺术家（可选）',
        placeholder: 'Kavinsky',
      },
      album: {
        label: '专辑（可选）',
        placeholder: 'OutRun',
      },
      year: {
        label: '发行年份（可选）',
        placeholder: '2010',
        error: '请输入有效的年份',
      },
      art: {
        embedded: '封面来自文件',
        none: '此文件没有封面',
      },
      uploading: '正在上传音频…',
      save: '添加',
      saveExisting: '保存',
      delete: '删除音频',
      deleteConfirm: {
        title: '删除此音频？',
        message: '音频及其文件将被删除。此操作无法撤销。',
        confirm: '删除',
        cancel: '取消',
      },
    },
    settings: {
      account: {
        title: '账户',
        noName: '你的账户',
      },
      manageAccount: {
        title: '管理账户',
        infoTitle: '账户信息',
        name: '姓名',
        email: '邮箱',
        memberSince: '注册时间',
        dangerTitle: '危险区域',
        deleteAccount: '删除账户',
        deleteAccountHint: '你的音频和片段将被永久删除。',
        deleteDialog: {
          title: '删除此账户？',
          message: '你的所有音频和片段将被永久删除。此操作无法撤销。',
          confirm: '删除',
          cancel: '取消',
        },
      },
      general: {
        title: '通用',
      },
      language: {
        label: '语言',
        en: 'English',
        es: 'Español',
        zh: '中文',
      },
      theme: {
        label: '主题',
        light: '浅色',
        dark: '深色',
        system: '跟随系统',
      },
      cancel: '取消',
      signOut: '退出登录',
      signOutDialog: {
        title: '退出登录?',
        message: '你需要重新登录才能访问你的音乐库。',
        cancel: '取消',
        confirm: '退出登录',
      },
      about: {
        title: '关于',
        appVersion: 'Sound Shaper 版本',
        expoUiVersion: 'Expo UI 版本',
      },
    },
    snackbar: {
      'google-sign-in-failed': 'Google 登录失败,请重试。',
      'apple-sign-in-failed': 'Apple 登录失败,请重试。',
      'sign-out-failed': '无法退出登录,请重试。',
      'session-expired': '会话已过期,请重新登录。',
      'song-created': '音频已添加',
      'song-updated': '音频已更新',
      'song-save-failed': '无法保存音频,请重试。',
      'song-deleted': '音频已删除',
      'song-delete-failed': '无法删除音频,请重试。',
      'clip-created': '片段已保存',
      'clip-save-failed': '无法保存片段,请重试。',
      'clip-deleted': '片段已删除',
      'clip-delete-failed': '无法删除片段,请重试。',
      'shape-created': '设置已保存',
      'shape-save-failed': '无法保存设置,请重试。',
      'shape-deleted': '设置已删除',
      'shape-delete-failed': '无法删除设置,请重试。',
      'delete-account-failed': '无法删除账户,请重试。',
      'delete-account-reauth': '请退出登录后重新登录,再重试删除。',
    },
  },
} as const;

export type Locale = keyof typeof translations;
export const SUPPORTED_LOCALES: Locale[] = ['en', 'es', 'zh'];
