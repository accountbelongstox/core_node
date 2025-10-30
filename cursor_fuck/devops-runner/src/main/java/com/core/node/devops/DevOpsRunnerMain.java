package com.core.node.devops;

public class DevOpsRunnerMain {
    public static void main(String[] args) {
        System.out.println("DevOps Runner");
        if (args != null && args.length > 0) {
            System.out.println("Command:");
            for (int i = 0; i < args.length; i++) {
                System.out.println("  [" + i + "]: " + args[i]);
            }
        }
    }
}


