<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\ItToolsV1\ItToolsV1Utils;

class ItToolsV1CalculatorUtil
{
    public static function calculateAge(string $birthdate): array
    {
        $birth = new \DateTime($birthdate);
        $now = new \DateTime();
        $diff = $now->diff($birth);
        
        $totalDays = $now->diff($birth)->days;
        $totalSeconds = $totalDays * 86400;
        
        return [
            'years' => $diff->y,
            'months' => $diff->m,
            'days' => $diff->d,
            'total_days' => $totalDays,
            'total_weeks' => floor($totalDays / 7),
            'total_months' => ($diff->y * 12) + $diff->m,
            'total_hours' => $totalDays * 24,
            'total_minutes' => $totalDays * 24 * 60,
            'total_seconds' => $totalSeconds,
            'next_birthday' => self::getNextBirthday($birthdate),
            'zodiac_sign' => self::getZodiacSign($birth->format('m'), $birth->format('d'))
        ];
    }
    
    public static function calculateBMI(float $weight, float $height, string $unit = 'metric'): array
    {
        if ($unit === 'imperial') {
            $weight = $weight * 0.453592;
            $height = $height * 0.0254;
        } else {
            $height = $height / 100;
        }
        
        $bmi = $weight / ($height * $height);
        
        $category = match(true) {
            $bmi < 18.5 => 'Underweight',
            $bmi < 25 => 'Normal weight',
            $bmi < 30 => 'Overweight',
            default => 'Obese'
        };
        
        return [
            'bmi' => round($bmi, 2),
            'category' => $category,
            'healthy_weight_range' => [
                'min' => round(18.5 * ($height * $height), 1),
                'max' => round(24.9 * ($height * $height), 1)
            ]
        ];
    }
    
    public static function calculateLoanEMI(float $principal, float $rate, int $months): array
    {
        $monthlyRate = ($rate / 12) / 100;
        
        if ($monthlyRate == 0) {
            $emi = $principal / $months;
        } else {
            $emi = $principal * $monthlyRate * pow(1 + $monthlyRate, $months) / (pow(1 + $monthlyRate, $months) - 1);
        }
        
        $totalAmount = $emi * $months;
        $totalInterest = $totalAmount - $principal;
        
        return [
            'emi' => round($emi, 2),
            'total_amount' => round($totalAmount, 2),
            'total_interest' => round($totalInterest, 2),
            'principal' => $principal,
            'interest_rate' => $rate,
            'tenure_months' => $months,
            'tenure_years' => round($months / 12, 1)
        ];
    }
    
    public static function calculateGST(float $amount, float $gstRate, string $operation = 'add'): array
    {
        $gstAmount = 0;
        $netAmount = 0;
        $grossAmount = 0;
        
        if ($operation === 'add') {
            $netAmount = $amount;
            $gstAmount = ($amount * $gstRate) / 100;
            $grossAmount = $amount + $gstAmount;
        } else {
            $grossAmount = $amount;
            $netAmount = $amount / (1 + ($gstRate / 100));
            $gstAmount = $amount - $netAmount;
        }
        
        return [
            'net_amount' => round($netAmount, 2),
            'gst_amount' => round($gstAmount, 2),
            'gross_amount' => round($grossAmount, 2),
            'gst_rate' => $gstRate
        ];
    }
    
    public static function numberToWords(int $number): string
    {
        if ($number == 0) {
            return 'Zero';
        }
        
        $ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
                 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
                 'Seventeen', 'Eighteen', 'Nineteen'];
        
        $tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
        
        $scales = ['', 'Thousand', 'Million', 'Billion', 'Trillion'];
        
        $words = [];
        $scaleIndex = 0;
        
        while ($number > 0) {
            $chunk = $number % 1000;
            
            if ($chunk > 0) {
                $chunkWords = [];
                
                $hundreds = floor($chunk / 100);
                if ($hundreds > 0) {
                    $chunkWords[] = $ones[$hundreds] . ' Hundred';
                }
                
                $remainder = $chunk % 100;
                if ($remainder >= 20) {
                    $chunkWords[] = $tens[floor($remainder / 10)];
                    if ($remainder % 10 > 0) {
                        $chunkWords[] = $ones[$remainder % 10];
                    }
                } elseif ($remainder > 0) {
                    $chunkWords[] = $ones[$remainder];
                }
                
                $chunkString = implode(' ', $chunkWords);
                if ($scales[$scaleIndex]) {
                    $chunkString .= ' ' . $scales[$scaleIndex];
                }
                
                array_unshift($words, $chunkString);
            }
            
            $number = floor($number / 1000);
            $scaleIndex++;
        }
        
        return implode(' ', $words);
    }
    
    private static function getNextBirthday(string $birthdate): array
    {
        $birth = new \DateTime($birthdate);
        $now = new \DateTime();
        
        $nextBirthday = new \DateTime($now->format('Y') . '-' . $birth->format('m-d'));
        
        if ($nextBirthday < $now) {
            $nextBirthday->modify('+1 year');
        }
        
        $diff = $now->diff($nextBirthday);
        
        return [
            'date' => $nextBirthday->format('Y-m-d'),
            'days_remaining' => $diff->days,
            'is_today' => $diff->days === 0
        ];
    }
    
    private static function getZodiacSign(int $month, int $day): string
    {
        $zodiacSigns = [
            ['Capricorn', 1, 20], ['Aquarius', 2, 19], ['Pisces', 3, 20],
            ['Aries', 4, 20], ['Taurus', 5, 21], ['Gemini', 6, 21],
            ['Cancer', 7, 23], ['Leo', 8, 23], ['Virgo', 9, 23],
            ['Libra', 10, 23], ['Scorpio', 11, 22], ['Sagittarius', 12, 22]
        ];
        
        foreach ($zodiacSigns as $index => $sign) {
            if ($month == $sign[1] && $day >= $sign[2]) {
                return $sign[0];
            }
            if ($month == $sign[1] + 1 && $day < $sign[2]) {
                return $sign[0];
            }
        }
        
        return $zodiacSigns[0][0];
    }
}
