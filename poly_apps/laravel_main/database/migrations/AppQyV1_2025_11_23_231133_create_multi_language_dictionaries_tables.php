<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private $languages = [
        'af', 'am', 'ar', 'as', 'az', 'bg', 'bn', 'bs', 'ca', 'cs',
        'cy', 'da', 'de', 'el', 'en', 'es', 'et', 'eu', 'fa', 'fi',
        'fil', 'fr', 'ga', 'gl', 'gu', 'he', 'hi', 'hr', 'hu', 'hy',
        'id', 'is', 'it', 'ja', 'jv', 'ka', 'kk', 'km', 'kn', 'ko',
        'lo', 'lt', 'lv', 'mk', 'ml', 'mn', 'mr', 'ms', 'mt', 'my',
        'nb', 'ne', 'nl', 'or', 'pa', 'pl', 'ps', 'pt', 'ro', 'ru',
        'si', 'sk', 'sl', 'so', 'sq', 'sr', 'su', 'sv', 'sw', 'ta',
        'te', 'th', 'tr', 'uk', 'ur', 'uz', 'vi', 'wuu', 'yue', 'zh', 'zu'
    ];

    public function up()
    {
        foreach ($this->languages as $langCode) {
            $tableName = "app_qy_v1_{$langCode}_dictionaries";
            
            Schema::connection('AppQyV1')->create($tableName, function (Blueprint $table) use ($langCode) {
                $table->id();
                
                $table->text('content')->nullable(false);
                $table->string('md5', 32)->nullable(false)->index();
                
                $table->json('translations')->nullable()->comment('Multi-language translations JSON array');
                $table->boolean('has_translation')->default(false)->nullable();
                $table->string('translation_provider', 100)->nullable()->comment('AI model identifier');
                
                $table->text('phonetic')->nullable()->comment('IPA phonetic or language-specific phonetic');
                $table->text('us_phonetic')->nullable()->comment('US English phonetic');
                $table->text('uk_phonetic')->nullable()->comment('UK English phonetic');
                
                $table->json('tts_files')->nullable()->comment('TTS audio files paths and metadata');
                $table->string('tts_provider', 100)->nullable()->comment('TTS service provider');
                
                $table->json('image_files')->nullable()->comment('Associated image files');
                $table->string('image_provider', 100)->nullable();
                
                $table->json('word_details')->nullable()->comment('Additional word metadata: part of speech, examples, etc');
                
                $table->boolean('is_exist_local')->default(false)->nullable();
                $table->boolean('has_operations')->default(true)->nullable();
                
                $table->integer('query_count')->default(0)->unsigned()->nullable();
                $table->dateTime('last_modified')->nullable();
                $table->dateTime('last_query_time')->nullable();
                
                $table->timestamps();
                
                $table->unique(['content', 'md5'], "unique_{$langCode}_content_md5");
                $table->index('content', "idx_{$langCode}_content");
                $table->index('query_count', "idx_{$langCode}_query_count");
                $table->index('has_translation', "idx_{$langCode}_has_translation");
                $table->index('last_query_time', "idx_{$langCode}_last_query_time");
            });
        }
    }

    public function down()
    {
        foreach ($this->languages as $langCode) {
            $tableName = "app_qy_v1_{$langCode}_dictionaries";
            Schema::connection('AppQyV1')->dropIfExists($tableName);
        }
    }
};
