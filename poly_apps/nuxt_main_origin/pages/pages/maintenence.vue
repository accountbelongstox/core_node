<template>
    <div class="flex min-h-screen items-center justify-center bg-gradient-to-t from-[#c39be3] to-[#f2eafa]">
        <div class="p-5 text-center">
            <h2 class="mb-10 text-3xl font-bold md:text-5xl">Under Maintenance</h2>
            <h4 class="mb-5 text-xl font-semibold text-primary sm:text-2xl">Thank you for visiting us.</h4>
            <p class="text-base">
                We are currently working on making some improvements <br class="hidden sm:block" />to give you better user experience. <br />
                <br />Please visit us again shortly.
            </p>
            <NuxtLink to="/" class="btn btn-primary mx-auto mt-5 w-max">Home</NuxtLink>
        </div>
    </div>
</template>
<script lang="ts" setup>
    useHead({ title: 'Maintenence' });
    definePageMeta({
        layout: 'auth-layout',
    });
</script>
