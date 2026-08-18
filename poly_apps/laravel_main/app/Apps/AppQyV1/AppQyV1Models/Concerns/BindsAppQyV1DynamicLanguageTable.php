<?php

namespace App\Apps\AppQyV1\AppQyV1Models\Concerns;

trait BindsAppQyV1DynamicLanguageTable
{
    protected ?string $langCode = null;

    abstract protected function resolveDynamicLanguageTable(string $language): string;

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);

        if (isset($attributes['lang_code'])) {
            $this->setLanguage((string) $attributes['lang_code']);
        }
    }

    public function setLanguage(string $language): static
    {
        $this->langCode = strtolower($language);
        $this->setTable($this->resolveDynamicLanguageTable($this->langCode));

        return $this;
    }

    public function getLanguage(): ?string
    {
        return $this->langCode;
    }

    public static function forLanguage(string $language): static
    {
        return (new static())->setLanguage($language);
    }
}
