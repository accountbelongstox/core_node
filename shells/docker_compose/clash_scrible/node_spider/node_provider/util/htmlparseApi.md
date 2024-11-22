// 选择器 (Selectors)
$(selector, context, root) // 在 root 的范围内搜索 context。

// 属性 (Attributes)
.attr(name, value) // 设置或获取属性值。
.prop(name, value) // 设置或获取属性值。
.data(name, value) // 设置或获取与元素相关的数据。
.val(value) // 设置或获取表单字段的值。
.removeAttr(name) // 移除元素的属性。
.hasClass(className) // 检查当前的元素是否含有某个特定的类。
.addClass(className) // 给元素添加一个类。
.removeClass(className) // 从元素中移除一个类。
.toggleClass(className, switch) // 切换元素的类。
.is(selector) // 判断当前集合中的元素是否符合选择器。
.is(element) // 判断给定的元素是否符合当前集合。
.is(selection) // 判断给定的选择器对象是否符合当前集合。
.is(function(index)) // 用一个函数来判断当前集合中的元素。

// 表单 (Forms)
.serializeArray() // 将表单元素编码为对象数组。

// 遍历 (Traversing)
.find(selector) // 查找匹配的元素。
.parent(selector) // 查找元素的父元素。
.parents(selector) // 查找元素的祖先元素。
.parentsUntil(selector, filter) // 查找当前元素的祖先元素，直到遇到匹配的那个为止。
.closest(selector) // 从元素本身开始，在它的祖先元素中查找最近的匹配。
.next(selector) // 获取下一个同级元素。
.nextAll(selector) // 获取所有后续同级元素。
.nextUntil(selector, filter) // 获取后面所有同辈元素，直到遇到匹配的那个为止。
.prev(selector) // 获取前一个同级元素。
.prevAll(selector) // 获取所有之前的同级元素。
.prevUntil(selector, filter) // 获取前面所有同辈元素，直到遇到匹配的那个为止。
.slice(start, end) // 获取一个元素的子集。
.siblings(selector) // 获取元素的同级元素。
.children(selector) // 获取元素的子元素。
.contents() // 获取元素的子节点。
.each(function(index, element)) // 遍历当前的元素集合。
.map(function(index, element)) // 通过一个函数匹配当前集合中的元素集合。
.filter(selector) // 减少匹配元素的集合。
.not(selector) // 移除匹配元素的集合。
.has(selector) // 过滤掉那些没有包含选择器所匹配元素的集合元素。
.first() // 获取当前集合中第一个元素。
.last() // 获取当前集合中最后一个元素。
.eq(i) // 获取当前集合中的第i个元素。
.get(i) // 获取当前集合中的第i个DOM元素。
.index(selector) // 搜索匹配的元素，并返回其索引值。
.end() // 结束最近的 "改变" 操作，并将匹配的元素列表返回到其前一个状态。
.add(selector, context) // 将一个选择器匹配的元素添加到当前集合。
.addBack(filter) // 将之前集合的元素添加到当前集合。

// 操作 (Manipulation)
.append(content) // 将内容追加到每个匹配元素里面。
.appendTo(target) // 将所有元素追加到目标元素中。
.prepend(content) // 将内容前置到每个匹配元素里面。
.prependTo(target) // 将所有元素前置到目标元素中。
.after(content) // 在每个匹配的元素后面插入内容。
.insertAfter(target) // 将元素集合插入到指定的目标元素后面。
.before(content) // 在每个匹配的元素之前插入内容。
.insertBefore(target) // 将元素集合插入到指定的目标元素前面。
.remove(selector) // 移除集合中匹配的元素
.replaceWith( content )
.empty()
.html( [htmlString] )
.text( [textString] )
.wrap( content )
.css( [propertName] ) .css( [ propertyNames] ) .css( [propertyName], [value] ) .css( [propertName], [function] ) .css( [properties] )
.toArray()
.clone()
$.root
$.contains( container, contained )
$.parseHTML( data [, context ] [, keepScripts ] )
$.load( html[, options ] )