"""
Complete fMP4 Encoder Implementation

Converts H.264 NAL units to fMP4 format for Media Source Extensions (MSE) playback.
This is a core pycore component that can be used by any app needing video streaming.
"""

import struct
from typing import List, Optional, Tuple
from dataclasses import dataclass


@dataclass
class H264Frame:
    """H.264 frame data"""
    data: bytes
    timestamp: int  # microseconds
    is_keyframe: bool


class FMP4Encoder:
    """
    fMP4 (Fragmented MP4) Encoder

    Converts H.264 NAL units to fMP4 format for MSE playback.

    Usage:
        encoder = FMP4Encoder(width=1080, height=2340, fps=60)

        # Generate initialization segment (once)
        init_segment = encoder.generate_init_segment(sps, pps)

        # Generate media segments (for each frame)
        media_segment = encoder.generate_media_segment(frame_data, timestamp, is_keyframe)

    Format:
        - Init segment: ftyp + moov boxes
        - Media segment: moof + mdat boxes
    """

    def __init__(self, width: int, height: int, fps: int = 60):
        self.width = width
        self.height = height
        self.fps = fps
        self.timescale = 90000  # Standard for H.264
        self.sequence_number = 1

        # Codec parameters (will be set from SPS/PPS)
        self.sps: Optional[bytes] = None
        self.pps: Optional[bytes] = None

    def generate_init_segment(self, sps: bytes, pps: bytes) -> bytes:
        """
        Generate fMP4 initialization segment

        Args:
            sps: Sequence Parameter Set
            pps: Picture Parameter Set

        Returns:
            fMP4 initialization segment (ftyp + moov)
        """
        self.sps = sps
        self.pps = pps

        ftyp = self._create_ftyp_box()
        moov = self._create_moov_box()

        return ftyp + moov

    def generate_media_segment(
        self,
        frame_data: bytes,
        timestamp: int,
        is_keyframe: bool
    ) -> bytes:
        """
        Generate fMP4 media segment

        Args:
            frame_data: H.264 frame data
            timestamp: Frame timestamp in microseconds
            is_keyframe: Whether frame is keyframe

        Returns:
            fMP4 media segment (moof + mdat)
        """
        moof = self._create_moof_box(frame_data, timestamp, is_keyframe)
        mdat = self._create_mdat_box(frame_data)

        self.sequence_number += 1

        return moof + mdat

    def _create_ftyp_box(self) -> bytes:
        """Create ftyp box"""
        return self._create_box(b'ftyp', b'iso5' + b'avc1' + b'iso6')

    def _create_moov_box(self) -> bytes:
        """Create moov box (movie header)"""
        mvhd = self._create_mvhd_box()
        trak = self._create_trak_box()
        mvex = self._create_mvex_box()

        return self._create_box(b'moov', mvhd + trak + mvex)

    def _create_mvhd_box(self) -> bytes:
        """Create mvhd box (movie header)"""
        data = struct.pack(
            '>IIQIIIHHIIIIIIIIIIIII',
            1,  # version + flags
            0,  # creation_time
            0,  # modification_time
            self.timescale,  # timescale
            0,  # duration
            0x00010000,  # rate (1.0)
            0x0100,  # volume (1.0)
            0,  # reserved
            0, 0,  # reserved
            0x00010000, 0, 0, 0,  # matrix
            0x00010000, 0, 0, 0,
            0x40000000,  # matrix
            0, 0, 0, 0, 0, 0,  # pre_defined
            2  # next_track_ID
        )

        return self._create_box(b'mvhd', data)

    def _create_trak_box(self) -> bytes:
        """Create trak box (track)"""
        tkhd = self._create_tkhd_box()
        mdia = self._create_mdia_box()

        return self._create_box(b'trak', tkhd + mdia)

    def _create_tkhd_box(self) -> bytes:
        """Create tkhd box (track header)"""
        data = struct.pack(
            '>IIQIQHH',
            0x0000000F,  # version + flags (track enabled)
            0,  # creation_time
            0,  # modification_time
            1,  # track_ID
            0,  # reserved
            0,  # duration
            0, 0  # reserved
        )

        # Add matrix and dimensions
        data += struct.pack(
            '>HHIIIIIIIIII',
            0,  # layer
            0,  # alternate_group
            0,  # volume
            0,  # reserved
            0x00010000, 0, 0, 0,  # matrix
            0x00010000, 0, 0, 0,
            0x40000000,  # matrix
            self.width << 16,  # width (fixed-point)
            self.height << 16  # height (fixed-point)
        )

        return self._create_box(b'tkhd', data)

    def _create_mdia_box(self) -> bytes:
        """Create mdia box (media)"""
        mdhd = self._create_mdhd_box()
        hdlr = self._create_hdlr_box()
        minf = self._create_minf_box()

        return self._create_box(b'mdia', mdhd + hdlr + minf)

    def _create_mdhd_box(self) -> bytes:
        """Create mdhd box (media header)"""
        data = struct.pack(
            '>IIQIHH',
            1,  # version + flags
            0,  # creation_time
            0,  # modification_time
            self.timescale,  # timescale
            0,  # duration
            0x55c4,  # language (und)
            0  # pre_defined
        )

        return self._create_box(b'mdhd', data)

    def _create_hdlr_box(self) -> bytes:
        """Create hdlr box (handler)"""
        data = struct.pack(
            '>IIII',
            0,  # version + flags
            0,  # pre_defined
            0x76696465,  # handler_type ('vide')
            0  # reserved
        )
        data += b'\x00' * 12  # reserved
        data += b'VideoHandler\x00'  # name

        return self._create_box(b'hdlr', data)

    def _create_minf_box(self) -> bytes:
        """Create minf box (media information)"""
        vmhd = self._create_vmhd_box()
        dinf = self._create_dinf_box()
        stbl = self._create_stbl_box()

        return self._create_box(b'minf', vmhd + dinf + stbl)

    def _create_vmhd_box(self) -> bytes:
        """Create vmhd box (video media header)"""
        data = struct.pack('>IHHHH', 1, 0, 0, 0, 0)
        return self._create_box(b'vmhd', data)

    def _create_dinf_box(self) -> bytes:
        """Create dinf box (data information)"""
        dref = self._create_box(b'dref', struct.pack('>II', 0, 1) +
                                self._create_box(b'url ', struct.pack('>I', 1)))
        return self._create_box(b'dinf', dref)

    def _create_stbl_box(self) -> bytes:
        """Create stbl box (sample table)"""
        stsd = self._create_stsd_box()
        stts = self._create_box(b'stts', struct.pack('>II', 0, 0))
        stsc = self._create_box(b'stsc', struct.pack('>II', 0, 0))
        stsz = self._create_box(b'stsz', struct.pack('>III', 0, 0, 0))
        stco = self._create_box(b'stco', struct.pack('>II', 0, 0))

        return self._create_box(b'stbl', stsd + stts + stsc + stsz + stco)

    def _create_stsd_box(self) -> bytes:
        """Create stsd box (sample description)"""
        avc1 = self._create_avc1_box()
        data = struct.pack('>II', 0, 1) + avc1

        return self._create_box(b'stsd', data)

    def _create_avc1_box(self) -> bytes:
        """Create avc1 box (AVC sample entry)"""
        data = b'\x00' * 6  # reserved
        data += struct.pack('>H', 1)  # data_reference_index
        data += b'\x00' * 16  # pre_defined + reserved
        data += struct.pack('>HH', self.width, self.height)
        data += struct.pack('>II', 0x00480000, 0x00480000)  # resolution
        data += struct.pack('>I', 0)  # reserved
        data += struct.pack('>H', 1)  # frame_count
        data += b'\x00' * 32  # compressorname
        data += struct.pack('>HH', 0x0018, 0xFFFF)  # depth + pre_defined

        # Add avcC box
        avcc = self._create_avcc_box()
        data += avcc

        return self._create_box(b'avc1', data)

    def _create_avcc_box(self) -> bytes:
        """Create avcC box (AVC configuration)"""
        if not self.sps or not self.pps:
            raise ValueError("SPS and PPS must be set before creating avcC box")

        data = struct.pack('>B', 1)  # configurationVersion
        data += self.sps[1:4]  # profile, profile_compat, level
        data += struct.pack('>B', 0xFF)  # lengthSizeMinusOne
        data += struct.pack('>B', 0xE1)  # numOfSequenceParameterSets
        data += struct.pack('>H', len(self.sps))  # SPS length
        data += self.sps
        data += struct.pack('>B', 1)  # numOfPictureParameterSets
        data += struct.pack('>H', len(self.pps))  # PPS length
        data += self.pps

        return self._create_box(b'avcC', data)

    def _create_mvex_box(self) -> bytes:
        """Create mvex box (movie extends)"""
        trex = self._create_trex_box()
        return self._create_box(b'mvex', trex)

    def _create_trex_box(self) -> bytes:
        """Create trex box (track extends)"""
        data = struct.pack('>IIIIII', 0, 1, 1, 0, 0, 0)
        return self._create_box(b'trex', data)

    def _create_moof_box(self, frame_data: bytes, timestamp: int, is_keyframe: bool) -> bytes:
        """Create moof box (movie fragment)"""
        mfhd = self._create_mfhd_box()
        traf = self._create_traf_box(frame_data, timestamp, is_keyframe)

        return self._create_box(b'moof', mfhd + traf)

    def _create_mfhd_box(self) -> bytes:
        """Create mfhd box (movie fragment header)"""
        data = struct.pack('>II', 0, self.sequence_number)
        return self._create_box(b'mfhd', data)

    def _create_traf_box(self, frame_data: bytes, timestamp: int, is_keyframe: bool) -> bytes:
        """Create traf box (track fragment)"""
        tfhd = self._create_tfhd_box()
        tfdt = self._create_tfdt_box(timestamp)
        trun = self._create_trun_box(frame_data, is_keyframe)

        return self._create_box(b'traf', tfhd + tfdt + trun)

    def _create_tfhd_box(self) -> bytes:
        """Create tfhd box (track fragment header)"""
        data = struct.pack('>II', 0x020000, 1)  # flags + track_ID
        return self._create_box(b'tfhd', data)

    def _create_tfdt_box(self, timestamp: int) -> bytes:
        """Create tfdt box (track fragment decode time)"""
        # Convert microseconds to timescale units
        decode_time = (timestamp * self.timescale) // 1000000

        data = struct.pack('>IQ', 1, decode_time)
        return self._create_box(b'tfdt', data)

    def _create_trun_box(self, frame_data: bytes, is_keyframe: bool) -> bytes:
        """Create trun box (track fragment run)"""
        flags = 0x000F05  # data_offset + sample_size + sample_flags + sample_duration

        # Sample flags
        sample_flags = 0x01010000 if is_keyframe else 0x00010000

        # Calculate data offset (size of moof box)
        data_offset = 8 + 8 + len(self._create_mfhd_box()) + len(self._create_tfhd_box()) + \
                     len(self._create_tfdt_box(0)) + 32  # Approximate

        data = struct.pack('>I', flags)
        data += struct.pack('>I', 1)  # sample_count
        data += struct.pack('>i', data_offset)  # data_offset
        data += struct.pack('>III',
                          self.timescale // self.fps,  # sample_duration
                          len(frame_data),  # sample_size
                          sample_flags)  # sample_flags

        return self._create_box(b'trun', data)

    def _create_mdat_box(self, frame_data: bytes) -> bytes:
        """Create mdat box (media data)"""
        return self._create_box(b'mdat', frame_data)

    @staticmethod
    def _create_box(box_type: bytes, data: bytes) -> bytes:
        """Create MP4 box with size and type"""
        size = len(data) + 8
        return struct.pack('>I', size) + box_type + data
