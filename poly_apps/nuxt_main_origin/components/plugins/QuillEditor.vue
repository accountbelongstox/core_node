<template>
    <div>
        <client-only>
            <component 
                :is="quillEditorComponent" 
                v-bind="$attrs"
            />
        </client-only>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const quillEditorComponent = ref(null);

onMounted(async () => {
    if (typeof window !== 'undefined') {
        const { quillEditor } = await import('vue3-quill');
        await import('vue3-quill/lib/vue3-quill.css');
        quillEditorComponent.value = quillEditor;
    }
});
</script> 