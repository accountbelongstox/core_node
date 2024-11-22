// """
// 当然，我们最常见的功能包括（复制，剪切，粘贴）。
//
// 为什么要自己实现
// Electron中默认禁用掉了右键功能，或者是出于安全考虑，公司业务不允许我们使用系统的右键功能，这时候我们就需要在嵌入electron的web应用当中实现自定义的右键功能，这篇文章主要介绍自己实现的四个自定义功能（新标签页打开，复制，剪切，粘贴）
//
// 先简单介绍一下涉及到的API
//
// contextmenu事件：主要是用来监听右键的点击事件的，具体可以看下官方文档
//
// Element: contextmenu event - Web APIs | MDN
// ​developer.mozilla.org/en-US/docs/web/api/element/contextmenu_event
//
// document.exceCommand()方法:
//
// document.execCommand - Web API 接口参考 | MDN
// ​developer.mozilla.org/zh-CN/docs/Web/API/Document/execCommand
//
// window.getSelection():
//
// Window.getSelection - Web API 接口参考 | MDN
// ​developer.mozilla.org/zh-CN/docs/Web/API/Window/getSelection
//
// 如何展示自定义右键功能菜单界面，什么时候展示，以下都是以react代码为例
//
// 展示菜单的所有前提就是我们需要监听contextmenu事件,当用户触发了事件后做一些对应的处理
//
// // 监听用户鼠标右击事件
// document.addEventListener('contextmenu', ()=>{})
// 复制：
//
// 什么时候展示复制？
//
// 复制的话肯定是我们有选中内容，才能进行复制，如果都没有选中内容的话，何谈复制呢
//
// const sel = window.getSelection()
// const { type } = sel
// type=== 'range' // 选中内容
// 通过window.getSelection()我们可以拿到当前光标的选区对象，通过type属性的返回值获取到当前光标的状态，具体的属性就不介绍了，大家可以自行去查找一下。
//
// 剪切：
//
// 什么时候展示剪切？
//
// 用户选中内容以及当前选中的内容区域是可编辑的，什么是可编辑的呢，HTML中大体可以分为三类：
//
// input标签，textarea标签，属性contentEditable为true的可编辑元素
//
// // 判断当前右键选中的元素是否可编辑
// function canEdit(target: HTMLElement) {
//   return (
//     target &&
//     (target.tagName === 'INPUT' ||
//       target.tagName === 'TEXTAREA' ||
//       !!target.isContentEditable)
//   )
// }
// 粘贴：
//
// 什么时候展示粘贴？
//
// 当前光标所在区域可编辑，并且剪切板中存在内容。
//
// 如何获取剪切板的内容，可以参考阮一峰老师的
//
// 教程
// ​www.ruanyifeng.com/blog/2021/01/clipboard-api.html
// 当然，在我一遍遍的尝试之后，发现有几个问题，兼容性，安全性，需要在https协议下才能获取，需要向用户获取权限，非常的繁琐，由于我们的背景是依赖于electron，所以可以通过electron提供接口的方式轻松获取到剪切板的内容具体的方式这里就不介绍了，有兴趣的可以自行查找electron API，我们这篇文章的重点侧重于浏览器这边。
//
// 新标签页打开：
//
// 这个就比较简单了，直接判断当前右击的元素是不是a标签就可以了
//
// function isTriggerOnTagA(target: HTMLElement) {
//   return !!target.closest('a')
// }
// 菜单的展示位置应该怎么设置
//
//  // 获得点击的位置
//  let { clientX, clientY } = event
// 看一下完整的代码
//
// function isTriggerOnTagA(target: HTMLElement) {
//   return !!target.closest('a')
// }
//
// function canInput(target: HTMLElement) {
//   return (
//     target &&
//     (target.tagName === 'INPUT' ||
//       target.tagName === 'TEXTAREA' ||
//       !!target.isContentEditable)
//   )
// }
// // 右键点击
//   const handleContextMenu = async (event: any) => {
//     // 屏蔽默认右键事件
//     if (!event.target) return
//     event.preventDefault()
//     try {
//       const res = await getClipboardTypes() // electron提供的剪切板内容接口
//       const eventTarget = event.target
//       if (eventTarget && isTriggerOnTagA(eventTarget)) {
//         targetUrl.current = eventTarget.closest('a').getAttribute('href') || ''
//       }
//
//       const sel = window.getSelection()!
//       const { type } = sel
//
//       const pasteHandle = (onlyText?: boolean) => {
//         if (!!eventTarget.isContentEditable) {
//          // 可编辑元素无法通过focus的方式聚焦
//           const newRange = sel.getRangeAt(0).cloneRange()
//           sel.removeAllRanges()
//           sel.addRange(newRange)
//         } else {
//           eventTarget.focus()
//         }
//         triggerPaste().then(() => {
//           setShow(false)
//         })
//       }
//       // 右键菜单列表以及展示的逻辑
//       const menu: MenuOption[] = [
//         {
//           label: '在新窗口中打开',
//           onclick: () => {
//             window.open(targetUrl.current)
//             setShow(false)
//           },
//           show: isTriggerOnTagA(eventTarget) && !!targetUrl.current
//         },
//         {
//           label: '复制',
//           onclick: () => {
//             document.execCommand('copy')
//             setShow(false)
//           },
//           show: type === 'Range'
//         },
//         {
//           label: '剪切',
//           onclick: () => {
//             document.execCommand('cut')
//             setShow(false)
//             eventTarget.focus()
//           },
//           show: type === 'Range' && canInput(eventTarget)
//         },
//         {
//           label: '粘贴',
//           onclick: () => {
//             pasteHandle()
//           },
//           show: canInput(eventTarget) && res && res.length > 0
//         },
//         {
//           label: '粘贴为纯文本',
//           onclick: () => {
//             pasteHandle(true)
//           },
//           show: false
//         }
//       ]
//       // 获得点击的位置
//       let { clientX, clientY } = event
//
//       // right为true，说明鼠标点击的位置到浏览器的右边界的宽度可以放下contextmenu。
//       setStyle(pre => {
//         return {
//           ...pre,
//           left: clientX,
//           top: clientY
//         }
//       })
//     } catch (error) {
//       console.log('error', error)
//     }
//   }
//
//
//
//   useEffect(() => {
//     document.addEventListener('contextmenu', handleContextMenu)
//     return () => {
//       document.removeEventListener('contextmenu', handleContextMenu)
//     }
//   }, [])
//
// """
//
// 请根据以上的文档编写一个可以在HTML中插入，并根据对应的元素弹出不同的右键菜单的类请不要省略以上的代码。如果你觉得有些代码。没用，你帮我保存在注释当中，以便我后续可以查看和优化他们下来就了。
