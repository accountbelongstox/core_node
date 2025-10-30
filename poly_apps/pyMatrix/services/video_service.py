"""视频流服务 - 占位符"""

class VideoService:
    """视频流服务（待实现）"""
    _instance = None

    @classmethod
    def instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
