<?php

namespace App\Apps\ItToolsV1\ItToolsV1NetworkCtl;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use App\Apps\ItToolsV1\ItToolsV1Utils\ResponseHelper;
use App\Apps\ItToolsV1\ItToolsV1Gvar\Constants;

class ItToolsV1NetworkCtl extends Controller
{
    public function ipv4Convert(Request $request)
    {
        $request->validate(['ip' => 'required|ip']);

        $ip = $request->input('ip');

        try {
            $parts = explode('.', $ip);
            $decimal = ($parts[0] * 16777216) + ($parts[1] * 65536) + ($parts[2] * 256) + $parts[3];
            $hexadecimal = strtoupper(dechex($decimal));
            $binary = decbin($decimal);

            return ResponseHelper::success([
                'dotted' => $ip,
                'decimal' => $decimal,
                'hexadecimal' => '0x' . $hexadecimal,
                'binary' => str_pad($binary, 32, '0', STR_PAD_LEFT)
            ]);
        } catch (\Exception $e) {
            return ResponseHelper::error(
                Constants::ERR_PROCESSING_ERROR,
                $e->getMessage(),
                null,
                500
            );
        }
    }

    public function ipv4Subnet(Request $request)
    {
        $request->validate([
            'ip' => 'required|ip',
            'cidr' => 'required|integer|min:0|max:32'
        ]);

        $ip = $request->input('ip');
        $cidr = $request->input('cidr');

        try {
            $ipLong = ip2long($ip);
            $mask = -1 << (32 - $cidr);
            $networkLong = $ipLong & $mask;
            $broadcastLong = $networkLong | ~$mask;

            $subnetMask = long2ip($mask);
            $wildcard = long2ip(~$mask);
            $networkAddress = long2ip($networkLong);
            $broadcastAddress = long2ip($broadcastLong);
            $firstHost = long2ip($networkLong + 1);
            $lastHost = long2ip($broadcastLong - 1);
            $hostCount = ($broadcastLong - $networkLong) - 1;

            $firstOctet = ($ipLong >> 24) & 255;
            if ($firstOctet < 128) {
                $ipClass = 'A';
            } elseif ($firstOctet < 192) {
                $ipClass = 'B';
            } else {
                $ipClass = 'C';
            }

            return ResponseHelper::success([
                'networkAddress' => $networkAddress,
                'broadcastAddress' => $broadcastAddress,
                'subnetMask' => $subnetMask,
                'cidr' => $cidr,
                'wildcard' => $wildcard,
                'firstHost' => $firstHost,
                'lastHost' => $lastHost,
                'hostCount' => $hostCount,
                'ipClass' => $ipClass
            ]);
        } catch (\Exception $e) {
            return ResponseHelper::error(
                Constants::ERR_PROCESSING_ERROR,
                $e->getMessage(),
                null,
                500
            );
        }
    }

    public function ipv4Expand(Request $request)
    {
        $request->validate(['range' => 'required|string']);

        $range = $request->input('range');

        try {
            if (!preg_match('/^(\d+\.\d+\.\d+\.\d+)-(\d+\.\d+\.\d+\.\d+)$/', $range, $matches)) {
                throw new \Exception('Invalid IP range format');
            }

            $startIp = $matches[1];
            $endIp = $matches[2];

            $startLong = ip2long($startIp);
            $endLong = ip2long($endIp);

            $ips = [];
            $count = 0;
            $maxIps = 1000;

            for ($i = $startLong; $i <= $endLong && $count < $maxIps; $i++) {
                $ips[] = long2ip($i);
                $count++;
            }

            return ResponseHelper::success([
                'ips' => $ips,
                'count' => $count,
                'truncated' => ($endLong - $startLong + 1) > $maxIps
            ]);
        } catch (\Exception $e) {
            return ResponseHelper::error(
                Constants::ERR_PROCESSING_ERROR,
                $e->getMessage(),
                null,
                500
            );
        }
    }

    public function macGenerate(Request $request)
    {
        $request->validate([
            'count' => 'sometimes|integer|min:1|max:50',
            'separator' => 'sometimes|string|in::,-',
            'uppercase' => 'sometimes|boolean'
        ]);

        $count = $request->input('count', 1);
        $separator = $request->input('separator', ':');
        $uppercase = $request->input('uppercase', true);

        try {
            $addresses = [];

            for ($i = 0; $i < $count; $i++) {
                $mac = [];
                for ($j = 0; $j < 6; $j++) {
                    $mac[] = str_pad(dechex(random_int(0, 255)), 2, '0', STR_PAD_LEFT);
                }

                $address = implode($separator, $mac);
                $addresses[] = $uppercase ? strtoupper($address) : $address;
            }

            return ResponseHelper::success(['addresses' => $addresses]);
        } catch (\Exception $e) {
            return ResponseHelper::error(
                Constants::ERR_PROCESSING_ERROR,
                $e->getMessage(),
                null,
                500
            );
        }
    }

    public function chmod(Request $request)
    {
        $request->validate(['mode' => 'required|string|regex:/^[0-7]{3}$/']);

        $mode = $request->input('mode');

        try {
            $perms = ['---', '--x', '-w-', '-wx', 'r--', 'r-x', 'rw-', 'rwx'];

            $owner = $perms[(int)$mode[0]];
            $group = $perms[(int)$mode[1]];
            $others = $perms[(int)$mode[2]];

            $symbolic = $owner . $group . $others;

            $descriptions = [
                'r' => 'read',
                'w' => 'write',
                'x' => 'execute',
                '-' => 'no permission'
            ];

            $ownerDesc = $this->formatPermissions($owner);
            $groupDesc = $this->formatPermissions($group);
            $othersDesc = $this->formatPermissions($others);

            return ResponseHelper::success([
                'octal' => $mode,
                'symbolic' => $symbolic,
                'owner' => $owner,
                'group' => $group,
                'others' => $others,
                'description' => "Owner: {$ownerDesc}; Group: {$groupDesc}; Others: {$othersDesc}"
            ]);
        } catch (\Exception $e) {
            return ResponseHelper::error(
                Constants::ERR_PROCESSING_ERROR,
                $e->getMessage(),
                null,
                500
            );
        }
    }

    public function randomPort(Request $request)
    {
        $request->validate([
            'count' => 'sometimes|integer|min:1|max:50',
            'min' => 'sometimes|integer|min:1024|max:65535',
            'max' => 'sometimes|integer|min:1024|max:65535'
        ]);

        $count = $request->input('count', 1);
        $min = $request->input('min', 1024);
        $max = $request->input('max', 65535);

        try {
            $ports = [];
            for ($i = 0; $i < $count; $i++) {
                $ports[] = random_int($min, $max);
            }

            return ResponseHelper::success(['ports' => $ports]);
        } catch (\Exception $e) {
            return ResponseHelper::error(
                Constants::ERR_PROCESSING_ERROR,
                $e->getMessage(),
                null,
                500
            );
        }
    }

    private function formatPermissions($perm)
    {
        $parts = [];
        if ($perm[0] === 'r') $parts[] = 'read';
        if ($perm[1] === 'w') $parts[] = 'write';
        if ($perm[2] === 'x') $parts[] = 'execute';

        return empty($parts) ? 'no permissions' : implode(', ', $parts);
    }
}
