package com.core.node.utils;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;

public final class PathResolver {
    private PathResolver() {}

    public static Path resolve(String base, String... parts) {
        Path p = base == null || base.isEmpty() ? Paths.get("") : Paths.get(base);
        if (parts != null) {
            for (String part : parts) {
                if (part != null && !part.isEmpty()) {
                    p = p.resolve(part);
                }
            }
        }
        return p.normalize();
    }

    public static String expandEnv(String value) {
        if (value == null) return null;
        String result = value;
        for (Map.Entry<String, String> e : System.getenv().entrySet()) {
            String name = e.getKey();
            String val = e.getValue();
            if (val == null) continue;
            result = result.replace("%" + name + "%", val);
            result = result.replace("${" + name + "}", val);
            result = result.replace("$" + name, val);
        }
        return result;
    }
}


