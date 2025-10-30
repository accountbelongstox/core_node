package com.core.node.devops;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

public class ProcessRunner {
    private Duration timeout = Duration.ofMinutes(30);

    public void setTimeout(Duration timeout) {
        if (timeout == null || timeout.isNegative() || timeout.isZero()) {
            throw new IllegalArgumentException("timeout must be positive");
        }
        this.timeout = timeout;
    }

    public int run(List<String> command, java.util.Map<String, String> extraEnv, java.nio.file.Path workingDir) throws IOException, InterruptedException {
        if (command == null || command.isEmpty()) {
            throw new IllegalArgumentException("command must not be empty");
        }
        ProcessBuilder builder = new ProcessBuilder(command);
        if (workingDir != null) {
            builder.directory(workingDir.toFile());
        }
        if (extraEnv != null && !extraEnv.isEmpty()) {
            builder.environment().putAll(extraEnv);
        }
        builder.redirectErrorStream(true);
        Process process = builder.start();
        Thread outputThread = new Thread(() -> {
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    System.out.println(line);
                }
            } catch (IOException ignored) {
            }
        });
        outputThread.setDaemon(true);
        outputThread.start();

        boolean finished = process.waitFor(timeout.toMillis(), java.util.concurrent.TimeUnit.MILLISECONDS);
        if (!finished) {
            process.destroyForcibly();
            throw new IOException("Process timed out");
        }
        return process.exitValue();
    }

    public int run(List<String> command) throws IOException, InterruptedException {
        return run(command, java.util.Collections.emptyMap(), null);
    }

    public int runShell(String shell, String scriptOrCommand) throws IOException, InterruptedException {
        List<String> cmd = new ArrayList<>();
        cmd.add(shell);
        cmd.add("-NoProfile");
        cmd.add("-NonInteractive");
        cmd.add("-Command");
        cmd.add(scriptOrCommand);
        return run(cmd);
    }
}


