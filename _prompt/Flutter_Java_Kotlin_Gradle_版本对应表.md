# Flutter、Java、Kotlin、Gradle 版本对应表

## 版本兼容性矩阵

### Android Gradle Plugin (AGP) 与相关版本对应

| AGP 版本 | Gradle 版本要求 | Java (JDK) 版本要求 | Kotlin 版本要求 | 说明 |
|---------|----------------|---------------------|----------------|------|
| 8.13+   | 8.11.1+        | Java 17+            | 1.9.0+         | 最新版本 |
| 8.11    | 8.9+           | Java 17+            | 1.9.0+         | 稳定版本 |
| 8.9     | 8.7+           | Java 17+            | 1.9.0+         | 稳定版本 |
| 8.5     | 8.5+           | Java 17+            | 1.9.0+         | |
| 8.3     | 8.4+           | Java 17+            | 1.9.0+         | |
| 8.2     | 8.2+           | Java 17+            | 1.8.22+        | |
| 8.1     | 8.0+           | Java 17+            | 1.8.22+        | |
| 8.0     | 8.0+           | Java 17+            | 1.8.22+        | |
| 7.4     | 7.5+           | Java 11+            | 1.7.20+        | |
| 7.3     | 7.4+           | Java 11+            | 1.7.20+        | |
| 7.2     | 7.3.3+         | Java 11+            | 1.7.10+        | |
| 7.1     | 7.2+           | Java 11+            | 1.6.21+        | |
| 7.0     | 7.0+           | Java 11+            | 1.6.21+        | |
| 4.2     | 6.7.1+         | Java 8+             | 1.4.32+        | 旧版本 |

### Flutter 版本与 Android 构建要求

| Flutter 版本 | 最低 Java 版本 | 推荐 AGP 版本 | 推荐 Gradle 版本 | 推荐 Kotlin 版本 | 说明 |
|-------------|--------------|-------------|----------------|----------------|------|
| 3.29+       | Java 17       | 8.2+        | 8.2+           | 1.9.0+          | 最新版本，移除命令式插件 |
| 3.24+       | Java 17       | 8.0+        | 8.0+           | 1.9.0+          | |
| 3.19+       | Java 17       | 8.0+        | 8.0+           | 1.9.0+          | |
| 3.16+       | Java 11       | 7.4+        | 7.5+           | 1.8.22+         | |
| 3.13+       | Java 11       | 7.3+        | 7.4+           | 1.8.20+         | |
| 3.10+       | Java 11       | 7.2+        | 7.3.3+         | 1.8.10+         | |
| 3.7+        | Java 11       | 7.1+        | 7.2+           | 1.7.20+         | |
| 3.3+        | Java 11       | 7.0+        | 7.0+           | 1.7.10+         | |
| 3.0+        | Java 8        | 4.2+        | 6.7.1+         | 1.5.30+         | |

### Gradle 版本与 Java 版本对应

| Gradle 版本 | 最低 Java 版本 | 最高 Java 版本 | 说明 |
|-----------|--------------|--------------|------|
| 8.11+     | Java 17      | Java 21      | 最新版本 |
| 8.9       | Java 17      | Java 21      | |
| 8.7       | Java 17      | Java 21      | |
| 8.5       | Java 17      | Java 21      | |
| 8.4       | Java 17      | Java 21      | |
| 8.2       | Java 17      | Java 21      | |
| 8.0       | Java 17      | Java 21      | |
| 7.6       | Java 11      | Java 19      | |
| 7.5       | Java 11      | Java 19      | |
| 7.4       | Java 11      | Java 19      | |
| 7.3       | Java 11      | Java 19      | |
| 7.2       | Java 11      | Java 19      | |
| 7.0       | Java 11      | Java 19      | |
| 6.9       | Java 8       | Java 15      | |
| 6.7       | Java 8       | Java 15      | |

### Kotlin 版本与 Java 版本对应

| Kotlin 版本 | 最低 Java 版本 | 最高 Java 版本 | 说明 |
|-----------|--------------|--------------|------|
| 2.0+      | Java 8       | Java 21      | 最新版本 |
| 1.9.24    | Java 8       | Java 21      | |
| 1.9.22    | Java 8       | Java 21      | |
| 1.9.20    | Java 8       | Java 21      | |
| 1.9.0     | Java 8       | Java 21      | |
| 1.8.22    | Java 8       | Java 19      | |
| 1.8.20    | Java 8       | Java 19      | |
| 1.8.10    | Java 8       | Java 19      | |
| 1.7.20    | Java 8       | Java 19      | |
| 1.7.10    | Java 8       | Java 19      | |
| 1.6.21    | Java 8       | Java 18      | |
| 1.5.30    | Java 8       | Java 16      | |

## 推荐配置组合

### 最新推荐配置（2024-2025）

```
Flutter: 3.29+
Java (JDK): 17 或 21
Kotlin: 1.9.24+
AGP: 8.9+
Gradle: 8.9+
```

### 稳定推荐配置

```
Flutter: 3.24+
Java (JDK): 17
Kotlin: 1.9.20+
AGP: 8.5+
Gradle: 8.5+
```

### 兼容旧项目配置

```
Flutter: 3.16+
Java (JDK): 11
Kotlin: 1.8.22+
AGP: 7.4+
Gradle: 7.5+
```

## 版本检查命令

### 检查 Flutter 版本
```bash
flutter --version
```

### 检查 Java 版本
```bash
java -version
javac -version
```

### 检查 Kotlin 版本
```bash
kotlin -version
```

### 检查 Gradle 版本
```bash
gradle --version
```

### 检查 AGP 版本
查看 `android/build.gradle` 文件中的：
```gradle
dependencies {
    classpath 'com.android.tools.build:gradle:8.5.2'
}
```

## 常见问题

### 1. Flutter 3.29+ 版本变化
- 移除了 Flutter Gradle 命令式插件
- 必须使用声明式插件配置
- 需要 Java 17+

### 2. AGP 8.0+ 版本要求
- 必须使用 Java 17+
- 必须使用 Gradle 8.0+
- 推荐使用 Kotlin 1.9.0+

### 3. 版本升级路径
- **从 Java 11 升级到 Java 17**: 需要同时升级 AGP 到 8.0+ 和 Gradle 到 8.0+
- **从 AGP 7.x 升级到 8.x**: 需要 Java 17+ 和 Gradle 8.0+
- **从 Kotlin 1.8 升级到 1.9**: 需要 AGP 8.0+ 和 Gradle 8.0+

## 注意事项

1. **Java 版本选择**:
   - Java 17 是 LTS 版本，推荐用于生产环境
   - Java 21 是最新 LTS 版本，但需要确保所有工具链支持

2. **Kotlin 版本**:
   - Kotlin 2.0+ 引入了新的编译器，需要确保兼容性
   - 建议使用 1.9.x 系列以获得最佳稳定性

3. **Gradle 版本**:
   - 使用 Gradle Wrapper 确保团队使用相同版本
   - 定期更新到稳定版本以获得安全修复

4. **Flutter 版本**:
   - 使用 `flutter upgrade` 保持最新
   - 查看 [Flutter 发布说明](https://docs.flutter.dev/release/breaking-changes) 了解重大变更

## 参考资料

- [Flutter 官方文档](https://docs.flutter.dev)
- [Android Gradle Plugin 发布说明](https://developer.android.com/build/releases/gradle-plugin)
- [Gradle 兼容性矩阵](https://docs.gradle.org/current/userguide/compatibility.html)
- [Kotlin 版本说明](https://kotlinlang.org/docs/releases.html)

---

**最后更新**: 2024年12月
**维护者**: 开发团队

