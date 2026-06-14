"""
pyutils.image_tools - image & media processing utilities.

    from pycore.pyutils.image_tools.image_processor import ...      # crop/split/merge/overlay/compress
    from pycore.pyutils.image_tools.media_compressor import MediaCompressor, get_media_compressor
    from pycore.pyutils.image_tools.dataset_generator import DatasetGenerator
    from pycore.pyutils.image_tools.icon_analyzer import ...
    from pycore.pyutils.image_tools.image_comparator import ...
    from pycore.pyutils.image_tools.image_matcher import ...
    from pycore.pyutils.image_tools.png_matcher import ...

Submodules are imported on demand (several pull in heavy optional packages such
as OpenCV / Pillow), so this package init stays light. Depends only on
pyutils.common (shared base), pyfoundations and pygvar.
"""
