package com.core.node.apps.videocompression;

import com.core.node.devops.ProcessRunner;

import java.nio.file.Path;
import java.nio.file.Paths;

public class VideoCompressionMain {
    public static void main(String[] args) throws Exception {
        if (args == null || args.length < 2) {
            System.out.println("Usage: java -jar app-video-compression.jar <input> <output> [crf]");
            return;
        }
        Path input = Paths.get(args[0]);
        Path output = Paths.get(args[1]);
        int crf = args.length >= 3 ? Integer.parseInt(args[2]) : 24;

        ProcessRunner pr = new ProcessRunner();
        VideoCompressor compressor = new VideoCompressor(pr);
        compressor.compress(input, output, crf);
        System.out.println("Compression completed: " + output);
    }
}


