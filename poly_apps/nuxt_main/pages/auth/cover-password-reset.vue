<template>
    <div class="flex min-h-screen">
        <div
            class="hidden min-h-screen w-1/2 flex-col items-center justify-center bg-gradient-to-t from-[#ff1361bf] to-[#44107A] p-4 text-white dark:text-black lg:flex"
        >
            <div class="mx-auto mb-5 w-full">
                <img src="/assets/images/auth-cover.svg" alt="coming_soon" class="mx-auto lg:max-w-[370px] xl:max-w-[500px]" />
            </div>
            <h3 class="mb-4 text-center text-3xl font-bold">Join the community of expert developers</h3>
            <p>It is easy to setup with great customer experience. Start your 7-day free trial</p>
        </div>
        <div class="relative flex w-full items-center justify-center lg:w-1/2">
            <div class="w-full max-w-[480px] p-5 md:p-10">
                <h2 class="mb-3 text-3xl font-bold">Password Reset</h2>
                <p class="mb-7">Enter your email to recover your ID</p>
                <form class="space-y-5" @submit.prevent="router.push('/')">
                    <div>
                        <label for="email">Email</label>
                        <input id="email" type="email" class="form-input" placeholder="Enter Email" />
                    </div>
                    <button type="submit" class="btn btn-primary w-full">RECOVER</button>
                </form>
            </div>
        </div>
    </div>
</template>
<script lang="ts" setup>
    import { useRouter } from 'vue-router';
    useHead({ title: 'Reset Password Cover' });
    const router = useRouter();
    definePageMeta({
        layout: 'auth-layout',
    });
</script>
