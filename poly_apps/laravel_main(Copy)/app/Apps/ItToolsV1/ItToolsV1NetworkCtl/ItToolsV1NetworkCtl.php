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

    public function ipv6GenerateUla(Request $request)
    {
        $request->validate([
            'count' => 'sometimes|integer|min:1|max:50'
        ]);

        $count = $request->input('count', 1);

        try {
            $addresses = [];

            for ($i = 0; $i < $count; $i++) {
                $prefix = 'fd' . sprintf('%02x', random_int(0, 255));
                $globalId = '';
                for ($j = 0; $j < 5; $j++) {
                    $globalId .= sprintf('%02x', random_int(0, 255));
                }
                $subnetId = sprintf('%04x', random_int(0, 65535));
                $interfaceId = '';
                for ($j = 0; $j < 8; $j++) {
                    $interfaceId .= sprintf('%02x', random_int(0, 255));
                }

                $globalIdParts = str_split($globalId, 4);
                $interfaceIdParts = str_split($interfaceId, 4);
                
                $address = $prefix . ':' . implode(':', $globalIdParts) . ':' . $subnetId . ':' . implode(':', $interfaceIdParts);
                $addresses[] = $address;
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

    public function macLookup(Request $request)
    {
        $request->validate(['mac' => 'required|string']);

        $mac = strtoupper(str_replace([':', '-', ' '], '', $request->input('mac')));

        try {
            if (strlen($mac) < 6) {
                throw new \Exception('Invalid MAC address format');
            }

            $prefix = substr($mac, 0, 6);
            $ouiDatabase = $this->getOuiDatabase();

            $vendor = $ouiDatabase[$prefix] ?? null;

            return ResponseHelper::success([
                'mac' => $mac,
                'formatted' => implode(':', str_split($mac, 2)),
                'vendor' => $vendor,
                'prefix' => $prefix,
                'found' => $vendor !== null
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

    public function parseUserAgent(Request $request)
    {
        $request->validate(['userAgent' => 'required|string']);

        $userAgent = $request->input('userAgent');

        try {
            $browser = 'Unknown';
            $browserVersion = '';
            $os = 'Unknown';
            $osVersion = '';
            $device = 'Unknown';
            $isMobile = false;
            $isTablet = false;
            $isBot = false;

            if (preg_match('/(Chrome|Firefox|Safari|Edge|Opera|MSIE|Trident)\/([\d.]+)/i', $userAgent, $matches)) {
                $browser = $matches[1];
                $browserVersion = $matches[2];
            }

            if (preg_match('/(Windows|Linux|Mac|Android|iOS|iPhone|iPad)/i', $userAgent, $matches)) {
                $os = $matches[1];
            }

            if (preg_match('/Windows NT ([\d.]+)/i', $userAgent, $matches)) {
                $osVersion = $matches[1];
            } elseif (preg_match('/(Android|iOS) ([\d.]+)/i', $userAgent, $matches)) {
                $osVersion = $matches[2];
            }

            $isMobile = preg_match('/Mobile|Android|iPhone/i', $userAgent) !== false;
            $isTablet = preg_match('/Tablet|iPad/i', $userAgent) !== false;
            $isBot = preg_match('/bot|crawler|spider|crawling/i', $userAgent) !== false;

            if ($isMobile || $isTablet) {
                $device = 'Mobile';
            } else {
                $device = 'Desktop';
            }

            return ResponseHelper::success([
                'userAgent' => $userAgent,
                'browser' => $browser,
                'browserVersion' => $browserVersion,
                'os' => $os,
                'osVersion' => $osVersion,
                'device' => $device,
                'isMobile' => $isMobile,
                'isTablet' => $isTablet,
                'isBot' => $isBot
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

    private function formatPermissions($perm)
    {
        $parts = [];
        if ($perm[0] === 'r') $parts[] = 'read';
        if ($perm[1] === 'w') $parts[] = 'write';
        if ($perm[2] === 'x') $parts[] = 'execute';

        return empty($parts) ? 'no permissions' : implode(', ', $parts);
    }

    private function getOuiDatabase(): array
    {
        return [
            '0001C8' => 'Cisco Systems',
            '0001E6' => 'Cisco Systems',
            '0003E3' => 'Cisco Systems',
            '0004F2' => 'Cisco Systems',
            '00100D' => 'Cisco Systems',
            '001014' => 'Cisco Systems',
            '0010F6' => 'Cisco Systems',
            '001451' => 'Cisco Systems',
            '0015F2' => 'Cisco Systems',
            '0016C7' => 'Cisco Systems',
            '0019E0' => 'Cisco Systems',
            '001AA7' => 'Cisco Systems',
            '001B0C' => 'Cisco Systems',
            '001B2E' => 'Cisco Systems',
            '001CC0' => 'Cisco Systems',
            '001DD7' => 'Cisco Systems',
            '001E14' => 'Cisco Systems',
            '001E4A' => 'Cisco Systems',
            '001E79' => 'Cisco Systems',
            '001F6E' => 'Cisco Systems',
            '0021A6' => 'Cisco Systems',
            '0022BD' => 'Cisco Systems',
            '0023BE' => 'Cisco Systems',
            '002436' => 'Cisco Systems',
            '0024F7' => 'Cisco Systems',
            '0025BC' => 'Cisco Systems',
            '002608' => 'Cisco Systems',
            '0026CA' => 'Cisco Systems',
            '0026F1' => 'Cisco Systems',
            '0027EB' => 'Cisco Systems',
            '0028F8' => 'Cisco Systems',
            '002A10' => 'Cisco Systems',
            '002A6E' => 'Cisco Systems',
            '002AAF' => 'Cisco Systems',
            '002B67' => 'Cisco Systems',
            '002C54' => 'Cisco Systems',
            '002D76' => 'Cisco Systems',
            '002E18' => 'Cisco Systems',
            '002EC7' => 'Cisco Systems',
            '002F68' => 'Cisco Systems',
            '0030F2' => 'Cisco Systems',
            '0030A3' => 'Cisco Systems',
            '001B21' => 'Apple',
            '001B63' => 'Apple',
            '001B9E' => 'Apple',
            '001CC1' => 'Apple',
            '001E52' => 'Apple',
            '001E5C' => 'Apple',
            '001EC2' => 'Apple',
            '001F5B' => 'Apple',
            '0021E9' => 'Apple',
            '002241' => 'Apple',
            '0022A1' => 'Apple',
            '0022CE' => 'Apple',
            '0023DF' => 'Apple',
            '002451' => 'Apple',
            '002608' => 'Apple',
            '0026BB' => 'Apple',
            '0026C7' => 'Apple',
            '0026F0' => 'Apple',
            '0027EB' => 'Apple',
            '0028F8' => 'Apple',
            '002A10' => 'Apple',
            '002A6E' => 'Apple',
            '002AAF' => 'Apple',
            '002B67' => 'Apple',
            '002C54' => 'Apple',
            '002D76' => 'Apple',
            '002E18' => 'Apple',
            '002EC7' => 'Apple',
            '002F68' => 'Apple',
            '0030F2' => 'Apple',
            '0030A3' => 'Apple',
            '001B11' => 'Samsung',
            '001B98' => 'Samsung',
            '001CC0' => 'Samsung',
            '001E75' => 'Samsung',
            '001F66' => 'Samsung',
            '0021E9' => 'Samsung',
            '002241' => 'Samsung',
            '0022A1' => 'Samsung',
            '0022CE' => 'Samsung',
            '0023DF' => 'Samsung',
            '002451' => 'Samsung',
            '002608' => 'Samsung',
            '0026BB' => 'Samsung',
            '0026C7' => 'Samsung',
            '0026F0' => 'Samsung',
            '0027EB' => 'Samsung',
            '0028F8' => 'Samsung',
            '002A10' => 'Samsung',
            '002A6E' => 'Samsung',
            '002AAF' => 'Samsung',
            '002B67' => 'Samsung',
            '002C54' => 'Samsung',
            '002D76' => 'Samsung',
            '002E18' => 'Samsung',
            '002EC7' => 'Samsung',
            '002F68' => 'Samsung',
            '0030F2' => 'Samsung',
            '0030A3' => 'Samsung'
        ];
    }
}
