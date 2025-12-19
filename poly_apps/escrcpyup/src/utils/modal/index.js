import logoPath from '$electron/resources/assets/logo.png'

export function adaptiveMessage(content, { type, system } = {}) {
  if (system) {
    new Notification(window.t(`common.${type}`), {
      icon: logoPath,
      body: content,
    })

    return {
      close: () => false,
    }
  }

  return ElMessage[type](content)
}
