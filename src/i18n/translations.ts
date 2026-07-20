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
      songEdit: 'New song',
      songEditExisting: 'Edit song',
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
          title: 'Your songs, your way',
          subtitle:
            'Upload the tracks you already have and play them your way.',
        },
        shape: {
          title: 'Shape the sound',
          subtitle: 'Slow it down, speed it up, bend the pitch.',
        },
        clip: {
          title: 'Clip the best parts',
          subtitle: "Mark a song's best seconds and jump right back to them.",
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
      addSong: 'Add song',
      error: {
        title: 'Could not load your songs',
        subtitle: 'Check your connection and try again.',
      },
    },
    player: {
      title: 'Now playing',
      play: 'Play',
      pause: 'Pause',
      next: 'Next song',
      previous: 'Previous song',
      speed: 'Speed',
      keepPitch: 'Keep pitch',
      keepPitchDescription: 'Hold the original tone while the speed changes.',
      tabs: {
        shape: 'Shape',
        clips: 'Clips',
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
        preview: 'Preview',
        saveClip: 'Save clip',
        sheetTitle: 'New clip',
        save: 'Save',
        labelField: 'Label (optional)',
        labelPlaceholder: 'The drop',
        empty: 'Frame your favorite part with the handles above.',
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
      uploading: 'Uploading song…',
      save: 'Add',
      saveExisting: 'Save',
      delete: 'Delete song',
      deleteConfirm: {
        title: 'Delete this song?',
        message:
          'The song and its file will be removed. This cannot be undone.',
        confirm: 'Delete',
        cancel: 'Cancel',
      },
    },
    settings: {
      account: {
        title: 'Account',
        noName: 'Your account',
      },
      username: {
        addPrompt: 'Tap to add your username',
        dialog: {
          title: 'Choose a username',
          fieldLabel: 'Username',
          confirm: 'Save',
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
      manageAccount: {
        title: 'Manage account',
        infoTitle: 'Account info',
        name: 'Name',
        email: 'Email',
        username: 'Username',
        usernameUnset: 'Not set yet',
        memberSince: 'Member since',
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
      'song-created': 'Song added',
      'song-updated': 'Song updated',
      'song-save-failed': 'Could not save the song. Please try again.',
      'song-deleted': 'Song deleted',
      'song-delete-failed': 'Could not delete the song. Please try again.',
      'clip-created': 'Clip saved',
      'clip-save-failed': 'Could not save the clip. Please try again.',
      'clip-deleted': 'Clip deleted',
      'clip-delete-failed': 'Could not delete the clip. Please try again.',
      'username-invalid':
        'Usernames are 3-20 letters, numbers, or underscores.',
      'username-taken': 'That username is already taken.',
      'username-updated': 'Username updated',
      'username-update-failed':
        'Could not update the username. Please try again.',
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
      songEdit: 'Nueva canción',
      songEditExisting: 'Editar canción',
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
          title: 'Tus canciones, a tu manera',
          subtitle: 'Sube las pistas que ya tienes y reprodúcelas a tu manera.',
        },
        shape: {
          title: 'Modela el sonido',
          subtitle: 'Ralentízalo, aceléralo, ajusta el tono.',
        },
        clip: {
          title: 'Recorta las mejores partes',
          subtitle:
            'Marca los mejores segundos de una canción y vuelve a ellos al instante.',
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
      addSong: 'Agregar canción',
      error: {
        title: 'No se pudieron cargar tus canciones',
        subtitle: 'Revisa tu conexión e inténtalo de nuevo.',
      },
    },
    player: {
      title: 'Reproduciendo',
      play: 'Reproducir',
      pause: 'Pausar',
      next: 'Siguiente canción',
      previous: 'Canción anterior',
      speed: 'Velocidad',
      keepPitch: 'Mantener el tono',
      keepPitchDescription:
        'Conserva el tono original mientras cambia la velocidad.',
      tabs: {
        shape: 'Moldear',
        clips: 'Clips',
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
        preview: 'Vista previa',
        saveClip: 'Guardar clip',
        sheetTitle: 'Nuevo clip',
        save: 'Guardar',
        labelField: 'Etiqueta (opcional)',
        labelPlaceholder: 'El drop',
        empty: 'Encuadra tu parte favorita con los controles de arriba.',
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
      uploading: 'Subiendo canción…',
      save: 'Agregar',
      saveExisting: 'Guardar',
      delete: 'Eliminar canción',
      deleteConfirm: {
        title: '¿Eliminar esta canción?',
        message:
          'La canción y su archivo se eliminarán. Esto no se puede deshacer.',
        confirm: 'Eliminar',
        cancel: 'Cancelar',
      },
    },
    settings: {
      account: {
        title: 'Cuenta',
        noName: 'Tu cuenta',
      },
      username: {
        addPrompt: 'Toca para agregar tu nombre de usuario',
        dialog: {
          title: 'Elige un nombre de usuario',
          fieldLabel: 'Nombre de usuario',
          confirm: 'Guardar',
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
      manageAccount: {
        title: 'Gestionar cuenta',
        infoTitle: 'Información de la cuenta',
        name: 'Nombre',
        email: 'Correo',
        username: 'Nombre de usuario',
        usernameUnset: 'Sin definir',
        memberSince: 'Miembro desde',
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
      'song-created': 'Canción agregada',
      'song-updated': 'Canción actualizada',
      'song-save-failed': 'No se pudo guardar la canción. Inténtalo de nuevo.',
      'song-deleted': 'Canción eliminada',
      'song-delete-failed':
        'No se pudo eliminar la canción. Inténtalo de nuevo.',
      'clip-created': 'Clip guardado',
      'clip-save-failed': 'No se pudo guardar el clip. Inténtalo de nuevo.',
      'clip-deleted': 'Clip eliminado',
      'clip-delete-failed': 'No se pudo eliminar el clip. Inténtalo de nuevo.',
      'username-invalid':
        'Los nombres de usuario tienen 3-20 letras, números o guiones bajos.',
      'username-taken': 'Ese nombre de usuario ya está en uso.',
      'username-updated': 'Nombre de usuario actualizado',
      'username-update-failed':
        'No se pudo actualizar el nombre de usuario. Inténtalo de nuevo.',
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
      songEdit: '新建歌曲',
      songEditExisting: '编辑歌曲',
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
          title: '你的歌曲，随你所愿',
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
      addSong: '添加歌曲',
      error: {
        title: '无法加载你的歌曲',
        subtitle: '请检查网络连接后重试。',
      },
    },
    player: {
      title: '正在播放',
      play: '播放',
      pause: '暂停',
      next: '下一首',
      previous: '上一首',
      speed: '速度',
      keepPitch: '保持音调',
      keepPitchDescription: '改变速度时保持原来的音调。',
      tabs: {
        shape: '塑形',
        clips: '片段',
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
        preview: '预览',
        saveClip: '保存片段',
        sheetTitle: '新片段',
        save: '保存',
        labelField: '标签（可选）',
        labelPlaceholder: '高潮部分',
        empty: '用上方的手柄框选你最喜欢的部分。',
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
      uploading: '正在上传歌曲…',
      save: '添加',
      saveExisting: '保存',
      delete: '删除歌曲',
      deleteConfirm: {
        title: '删除这首歌曲？',
        message: '歌曲及其文件将被删除。此操作无法撤销。',
        confirm: '删除',
        cancel: '取消',
      },
    },
    settings: {
      account: {
        title: '账户',
        noName: '你的账户',
      },
      username: {
        addPrompt: '点按以添加用户名',
        dialog: {
          title: '选择用户名',
          fieldLabel: '用户名',
          confirm: '保存',
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
      manageAccount: {
        title: '管理账号',
        infoTitle: '账号信息',
        name: '姓名',
        email: '邮箱',
        username: '用户名',
        usernameUnset: '尚未设置',
        memberSince: '注册时间',
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
      'song-created': '歌曲已添加',
      'song-updated': '歌曲已更新',
      'song-save-failed': '无法保存歌曲,请重试。',
      'song-deleted': '歌曲已删除',
      'song-delete-failed': '无法删除歌曲,请重试。',
      'clip-created': '片段已保存',
      'clip-save-failed': '无法保存片段,请重试。',
      'clip-deleted': '片段已删除',
      'clip-delete-failed': '无法删除片段,请重试。',
      'username-invalid': '用户名为 3-20 个字母、数字或下划线。',
      'username-taken': '该用户名已被占用。',
      'username-updated': '用户名已更新',
      'username-update-failed': '无法更新用户名,请重试。',
    },
  },
} as const;

export type Locale = keyof typeof translations;
export const SUPPORTED_LOCALES: Locale[] = ['en', 'es', 'zh'];
