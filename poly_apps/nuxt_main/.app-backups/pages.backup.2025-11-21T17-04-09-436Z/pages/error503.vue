<template>
    <div class="flex min-h-screen items-center justify-center bg-gradient-to-t from-[#c39be3] to-[#f2eafa]">
        <div class="p-5 text-center font-semibold">
            <h2 class="mb-8 text-[50px] font-bold leading-none md:text-[80px]">Error 503</h2>
            <h4 class="mb-5 text-xl font-semibold text-primary sm:text-5xl">Ooops!</h4>
            <p class="text-base">Service Unavailable!</p>
            <NuxtLink to="/" class="btn btn-primary mx-auto mt-10 w-max">Home</NuxtLink>
        </div>
    </div>
</template>
<script lang="ts" setup>
    useHead({ title: 'Error 503' });
    definePageMeta({
        layout: 'auth-layout',
    });
</script>
