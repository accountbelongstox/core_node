<?php

namespace App\Contracts;

interface AppInitializerInterface
{
    public function initialize(bool $force = false): array;
    
    public function getAppName(): string;
    
    public function checkInitializationStatus(): array;
    
    public function reset(): array;
}
