<template>
    <div
        class="flex min-h-screen items-center justify-center bg-[url('/assets/images/map.svg')] bg-cover bg-center dark:bg-[url('/assets/images/map-dark.svg')]"
    >
        <div class="panel m-6 w-full max-w-lg sm:w-[480px]">
            <div class="mb-10 flex items-center">
                <div class="ltr:mr-4 rtl:ml-4">
                    <img src="/assets/images/profile-1.jpeg" class="h-16 w-16 rounded-full object-cover" alt="images" />
                </div>
                <div class="flex-1">
                    <h4 class="text-2xl">Shaun Park</h4>
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
</template>
<script lang="ts" setup>
    import { useRouter } from 'vue-router';
    useHead({ title: 'Lockscreen Boxed' });
    const router = useRouter();
    definePageMeta({
        layout: 'auth-layout',
    });
</script>
