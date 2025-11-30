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
                <div class="mb-10 flex items-center">
                    <div class="ltr:mr-4 rtl:ml-4">
                        <img src="/assets/images/profile-1.jpeg" class="h-16 w-16 rounded-full object-cover" alt="images" />
                    </div>
                    <div class="flex-1">
                        <h4 class="text-3xl">Shaun Park</h4>
                        <p>Enter your password to unlock your ID</p>
                    </div>
                </div>
                <form class="space-y-5" @submit.prevent="router.push('/')">
                    <div>
                        <label for="password">Password</label>
                        <input id="password" type="password" class="form-input" placeholder="Enter Password" />
                    </div>
                    <button type="submit" class="btn btn-primary w-full">UNLOCK</button>
                </form>
            </div>
        </div>
    </div>
</template>
<script lang="ts" setup>
    import { useRouter } from 'vue-router';
    useHead({ title: 'Lockscreen Cover' });
    const router = useRouter();
    definePageMeta({
        layout: 'auth-layout',
    });
</script>
