#!/usr/bin/env python3

from keys_center import KeysCenter

class FrameworkConfigs:
    @staticmethod
    def get_actions(project_type):
        configs = {
            KeysCenter.PROJECT_TYPE_NUXT: [
                KeysCenter.ACTION_DEBUG,
                KeysCenter.ACTION_BUILD,
                KeysCenter.ACTION_GENERATE,
            ],
            KeysCenter.PROJECT_TYPE_NEXT: [
                KeysCenter.ACTION_DEBUG,
                KeysCenter.ACTION_BUILD,
                KeysCenter.ACTION_PREVIEW,
            ],
            KeysCenter.PROJECT_TYPE_REACT: [
                KeysCenter.ACTION_DEBUG,
                KeysCenter.ACTION_BUILD,
                KeysCenter.ACTION_PREVIEW,
            ],
            KeysCenter.PROJECT_TYPE_REACT_NATIVE: [
                KeysCenter.ACTION_DEBUG,
                KeysCenter.ACTION_BUILD,
                KeysCenter.ACTION_RELEASE,
            ],
            KeysCenter.PROJECT_TYPE_VUE: [
                KeysCenter.ACTION_DEBUG,
                KeysCenter.ACTION_BUILD,
                KeysCenter.ACTION_PREVIEW,
            ],
            KeysCenter.PROJECT_TYPE_VITE: [
                KeysCenter.ACTION_DEBUG,
                KeysCenter.ACTION_BUILD,
                KeysCenter.ACTION_PREVIEW,
            ],
            KeysCenter.PROJECT_TYPE_FLUTTER: [
                KeysCenter.ACTION_DEBUG,
                KeysCenter.ACTION_BUILD,
                KeysCenter.ACTION_RELEASE,
            ],
            KeysCenter.PROJECT_TYPE_LARAVEL: [
                KeysCenter.ACTION_DEBUG,
            ],
        }
        return configs.get(project_type, [KeysCenter.ACTION_DEBUG])

    @staticmethod
    def get_platforms(project_type):
        configs = {
            KeysCenter.PROJECT_TYPE_NUXT: [
                KeysCenter.PLATFORM_WEB,
                KeysCenter.PLATFORM_DEPLOY_LARAVEL,
            ],
            KeysCenter.PROJECT_TYPE_NEXT: [
                KeysCenter.PLATFORM_WEB,
                KeysCenter.PLATFORM_DEPLOY_LARAVEL,
            ],
            KeysCenter.PROJECT_TYPE_REACT: [
                KeysCenter.PLATFORM_WEB,
                KeysCenter.PLATFORM_DEPLOY_LARAVEL,
            ],
            KeysCenter.PROJECT_TYPE_REACT_NATIVE: [
                KeysCenter.PLATFORM_ANDROID,
                KeysCenter.PLATFORM_IOS,
                KeysCenter.PLATFORM_WEB,
                KeysCenter.PLATFORM_DEPLOY_LARAVEL,
            ],
            KeysCenter.PROJECT_TYPE_VUE: [
                KeysCenter.PLATFORM_WEB,
                KeysCenter.PLATFORM_DEPLOY_LARAVEL,
            ],
            KeysCenter.PROJECT_TYPE_VITE: [
                KeysCenter.PLATFORM_WEB,
                KeysCenter.PLATFORM_DEPLOY_LARAVEL,
            ],
            KeysCenter.PROJECT_TYPE_FLUTTER: [
                KeysCenter.PLATFORM_ANDROID,
                KeysCenter.PLATFORM_IOS,
                KeysCenter.PLATFORM_WEB,
                KeysCenter.PLATFORM_LINUX,
            ],
            KeysCenter.PROJECT_TYPE_LARAVEL: [
                KeysCenter.PLATFORM_WEB,
            ],
        }
        return configs.get(project_type, [KeysCenter.PLATFORM_WEB])

    @staticmethod
    def get_action_display_name(action):
        names = {
            KeysCenter.ACTION_DEBUG: "Debug",
            KeysCenter.ACTION_BUILD: "Build",
            KeysCenter.ACTION_GENERATE: "Generate",
            KeysCenter.ACTION_RELEASE: "Release",
            KeysCenter.ACTION_PREVIEW: "Preview",
        }
        return names.get(action, action.capitalize())

    @staticmethod
    def get_platform_display_name(platform):
        names = {
            KeysCenter.PLATFORM_WEB: "Web",
            KeysCenter.PLATFORM_ANDROID: "Android",
            KeysCenter.PLATFORM_IOS: "iOS",
            KeysCenter.PLATFORM_LINUX: "Linux",
            KeysCenter.PLATFORM_WINDOWS: "Windows",
            KeysCenter.PLATFORM_MACOS: "macOS",
            KeysCenter.PLATFORM_DEPLOY_LARAVEL: "Deploy+Laravel",
        }
        return names.get(platform, platform.capitalize())
