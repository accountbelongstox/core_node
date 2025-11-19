<template>
    <div>
        <ul class="flex space-x-2 rtl:space-x-reverse">
            <li>
                <a href="javascript:;" class="text-primary hover:underline">Components</a>
            </li>
            <li class="before:content-['/'] ltr:before:mr-2 rtl:before:ml-2">
                <span>Lightbox</span>
            </li>
        </ul>
        <div>
            <div class="space-y-8 pt-5">
                <div class="panel flex items-center overflow-x-auto whitespace-nowrap p-3 text-primary">
                    <div class="rounded-full bg-primary p-1.5 text-white ring-2 ring-primary/30 ltr:mr-3 rtl:ml-3">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5">
                            <path
                                d="M19.0001 9.7041V9C19.0001 5.13401 15.8661 2 12.0001 2C8.13407 2 5.00006 5.13401 5.00006 9V9.7041C5.00006 10.5491 4.74995 11.3752 4.28123 12.0783L3.13263 13.8012C2.08349 15.3749 2.88442 17.5139 4.70913 18.0116C9.48258 19.3134 14.5175 19.3134 19.291 18.0116C21.1157 17.5139 21.9166 15.3749 20.8675 13.8012L19.7189 12.0783C19.2502 11.3752 19.0001 10.5491 19.0001 9.7041Z"
                                stroke="currentColor"
                                stroke-width="1.5"
                            />
                            <path
                                opacity="0.5"
                                d="M7.5 19C8.15503 20.7478 9.92246 22 12 22C14.0775 22 15.845 20.7478 16.5 19"
                                stroke="currentColor"
                                stroke-width="1.5"
                                stroke-linecap="round"
                            />
                        </svg>
                    </div>
                    <span class="ltr:mr-3 rtl:ml-3">Documentation: </span
                    ><a href="https://www.npmjs.com/package/vue-easy-lightbox" target="_blank" class="block hover:underline"
                        >https://www.npmjs.com/package/vue-easy-lightbox</a
                    >
                </div>

                <!-- Lightbox -->
                <div class="panel">
                    <h5 class="mb-5 text-lg font-semibold dark:text-white-light">Lightbox</h5>
                    <div class="mb-5">
                        <div class="mb-5 flex">
                            <div class="ltr:mr-4 rtl:ml-4">
                                <input v-model="allcontrols" :value="true" type="radio" @change="bindFancybox()" class="form-radio mt-1.5" checked />
                            </div>
                            <div class="flex-1">
                                <h4 class="text-lg font-semibold text-primary">All controls</h4>
                                <p class="media-text">Caption, slideshow, thumbnails and fullscreen buttons, tap to toggle controls</p>
                            </div>
                        </div>
                        <div class="flex">
                            <div class="ltr:mr-4 rtl:ml-4">
                                <input v-model="allcontrols" :value="false" type="radio" @change="bindFancybox()" class="form-radio mt-1.5" />
                            </div>
                            <div class="flex-1">
                                <h4 class="text-lg font-semibold text-primary">Minimal</h4>
                                <p class="media-text">No caption, no slideshow, no thumbnails, no fullscreen, tap to close</p>
                            </div>
                        </div>
                        <div class="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                            <template v-for="(item, i) in items" :key="i">
                                <a
                                    href="javascript:;"
                                    :class="{ 'md:col-span-2 md:row-span-2': i == 3 }"
                                    @click="
                                        index = i;
                                        visible = true;
                                    "
                                >
                                    <img :src="item.src" alt="image-gallery" class="h-full w-full rounded-md object-cover" />
                                </a>
                            </template>
                            <vue-easy-lightbox
                                :visible="visible"
                                :imgs="items"
                                :index="index"
                                scrollDisabled
                                moveDisabled
                                loop
                                :class="{ minimal: !allcontrols }"
                                @hide="
                                    index = null;
                                    visible = false;
                                "
                            ></vue-easy-lightbox>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
<script lang="ts" setup>
    import { ref, onMounted } from 'vue';
    import VueEasyLightbox from 'vue-easy-lightbox';
    useHead({ title: 'Lightbox' });

    const items: any = ref([]);
    const index: any = ref(null);
    const allcontrols = ref(true);
    const visible = ref(false);

    onMounted(() => {
        bindFancybox();
    });

    const bindFancybox = () => {
        if (allcontrols.value) {
            items.value = [
                {
                    src: '/assets/images/lightbox1.jpg',
                    title: 'This is dummy caption. It has been placed here solely to demonstrate the look and feel of finished, typeset text.',
                    description: 'Photo: Samuel Rohl',
                },
                {
                    src: '/assets/images/lightbox2.jpeg',
                    title: 'This is dummy caption. It has been placed here solely to demonstrate the look and feel of finished, typeset text.',
                    description: 'Photo: Samuel Rohl',
                },
                {
                    src: '/assets/images/lightbox3.jpeg',
                    title: "Dummy caption. It's Greek to you. Unless, of course, you're Greek, in which case, it really makes no sense.",
                    description: 'Photo: Michael Hull',
                },
                {
                    src: '/assets/images/lightbox4.jpeg',
                    title: 'This is dummy caption.',
                    description: 'Photo: Folkert Gorter',
                },
                {
                    src: '/assets/images/lightbox5.jpeg',
                    title: "It's a dummy caption. He who searches for meaning here will be sorely disappointed.",
                    description: 'Photo: Thomas Lefebvre',
                },
                {
                    src: '/assets/images/lightbox6.jpeg',
                    title: "It's a dummy caption. He who searches for meaning here will be sorely disappointed.",
                    description: 'Photo: Thomas Lefebvre',
                },
            ];
        } else {
            items.value = [
                {
                    src: '/assets/images/lightbox1.jpg',
                },
                {
                    src: '/assets/images/lightbox2.jpeg',
                },
                {
                    src: '/assets/images/lightbox3.jpeg',
                },
                {
                    src: '/assets/images/lightbox4.jpeg',
                },
                {
                    src: '/assets/images/lightbox5.jpeg',
                },
                {
                    src: '/assets/images/lightbox6.jpeg',
                },
            ];
        }
    };
</script>
