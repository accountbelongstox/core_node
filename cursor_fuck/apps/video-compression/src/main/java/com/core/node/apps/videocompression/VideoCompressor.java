package com.core.node.apps.videocompression;

import com.core.node.devops.ProcessRunner;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

public class VideoCompressor {
    private final ProcessRunner processRunner;

    public VideoCompressor(ProcessRunner processRunner) {
        this.processRunner = processRunner;
    }

    public void compress(Path input, Path output, int crf) throws IOException, InterruptedException {
        if (input == null || !Files.isRegularFile(input)) {
            throw new IllegalArgumentException("input file not found");
        }
        if (output == null) {
            throw new IllegalArgumentException("output path required");
        }
        if (crf < 18 || crf > 35) {
            throw new IllegalArgumentException("crf must be between 18 and 35");
        }

        List<String> cmd = new ArrayList<>();
        cmd.add("ffmpeg");
        cmd.add("-y");
        cmd.add("-i");
        cmd.add(input.toString());
        cmd.add("-c:v");
        cmd.add("libx264");
        cmd.add("-preset");
        cmd.add("medium");
        cmd.add("-crf");
        cmd.add(Integer.toString(crf));
        cmd.add("-c:a");
        cmd.add("aac");
        cmd.add(output.toString());

        int code = processRunner.run(cmd);
        if (code != 0) {
            throw new IOException("ffmpeg exited with code " + code);
        }
    }
}


