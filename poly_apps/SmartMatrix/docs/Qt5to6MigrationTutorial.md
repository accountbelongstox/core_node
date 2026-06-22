有没有人有 Qt5 到 6 的教程？
QML
一直在用 Qt5。 升级到 qt6 之后，虽然能编译运行，但新的 qml 编译器会抛出成千上万的错误（即使在 Qt 自己的例子中也是如此）

有没有人经历过这个过程，编译了一个关于不同 qmltc 错误/警告及其修复方法的列表？

我发现的一些问题，比如从 'import QtQuick.Controls' 切换到 'import QtQuick.Controls.Material'，这解决了关于不知道什么是 'Label' 的抱怨。

我遇到的一些其他错误包括：

"检测到歧义类型。 Toolbar 1.0 被多次定义"

"无法编译 onTextEdited 的绑定：指令 'generate_initializeBlockDeadTenporalZone' 未实现"
"无法编译 onTextEdited 的绑定：指令'generate_initializeBlockDeadTenporalZone' 未实现"


Upvote
8

Downvote

8
Go to comments


Share
u/ThinkvasAI avatar
ThinkvasAI
•
Promoted

All great ideas start from a canvas, not just a single AI chat box. Start many chats in parallel, branch off at any point, only in Thinkvas
All great ideas start from a canvas, not just a single AI chat box. Start many chats in parallel, branch off at any point, only in Thinkvas
All great ideas start from a canvas, not just a single AI chat box. Start many chats in parallel, branch off at any point, only in Thinkvas
All great ideas start from a canvas, not just a single AI chat box. Start many chats in parallel, branch off at any point, only in Thinkvas
thinkvasai.com
Learn More
Join the conversation
Sort by:

Best

Search Comments
Expand comment search
Comments Section
AntisocialMedia666
•
3y ago
Qt Professional
看起来你正试图从 Quick.Controls 1.x 迁移到 Quick.Controls 2.x，但这行不通。 命名真是太糟糕了，它们根本没有任何共同之处。 Quick Controls 1 已经从 Qt6 中移除。 如果你有 Quick Controls 1 的源代码，除了重写之外，你什么也做不了。 尽管如此，Quick/Qml 中的大多数其他东西（Item、Rectangle、ListView 等等）仍然存在，警告应该基本能说明问题， 它们中的大多数通常是关于使用 onPropChanged: function 带有参数而不是 onPropChanged:{} - 推荐的方法是先迁移到 Qt 5.15.x（可以运行但会警告），然后再迁移到 Qt 6。 https://doc.qt.io/qt-6/portingguide.html



Upvote
1

Downvote

Reply

Award

Share

xicor
OP
•
3y ago
•
Edited 3y ago
不行。 这完全是 quick controls 2。 我用了 qtquick gallery 的例子。 你拿那个例子，在 qt 6.4.2 中编译，它会抛出一堆错误和警告。 真的只是从 creator 的“examples”按钮打开它，然后在 6.4.2 中编译，然后砰的一声，出现了数十亿个没有正确编译的警告

我五年没用过 controls 1 了

当你使用 'let val =1' 或任何其他局部 js 变量在信号回调函数中时，就会发生 generate_initualizeBlockDeadTemporalZone 错误。

至于链接，我之前已经读过了。 它从未提及任何关于“常见的 qmltc 错误”或如何修复它们的内容。 我已经从 Qt 博客上看到了一些东西，比如切换到导入 QtQuick.Controls.Material，但除此之外，这些错误基本上从未在任何地方被提及。

我看到的另一个问题是，当你在另一个 qml 文件中使用来自同一模块的 qml 文件时，编译器似乎绝对不喜欢它。 无论我做什么，它总是抱怨。



Upvote
1

Downvote

Reply

Award

Share

AntisocialMedia666
•
3y ago
Qt Professional
哦，明白了。不好意思，我还以为是很容易就能找到的。这台机器上没装例子，所以现在没法看。



Upvote
1

Downvote

Reply

Award

Share

xicor
OP
•
3y ago
看起来这功能是自带的，就在欢迎页面的一个按钮上。



Upvote
1

Downvote

Reply

Award

Share

AntisocialMedia666
•
3y ago
Qt Professional
我知道，但我通常用 aqt 安装所有东西，然后跳过示例。


Upvote
1

Downvote

Reply

Award

Share

xicor
OP
•
3y ago
结果经过更多调试后发现，这些错误只有在你从维护工具安装了“Qt Quick Compiler Extensions”时才会发生。不知道为什么这会是默认选项，当你只选择 6.4 的时候。


Upvote
1

Downvote

Reply

Award

Share

dobeyactual
•
3y ago
Open Source Developer
你也在 QML 文件上用 Qt6 运行 qmllint 吗？



Upvote
1

Downvote

Reply

Award

Share

xicor
OP
•
3y ago
我在做例子里做的事情。我在 cmake lists 里调用 qt_add_qml_module。

基本上，在我自己的项目里遇到问题后，我就直接去 creator 里的例子了（用 controls gallery 例子）。

我希望它能原样运行，没有任何修改，并且不会报错，这样我就可以看看 Qt 做了什么不同的事情。（他们没做什么不同的事情，所以我得到了和我项目里一样的错误）