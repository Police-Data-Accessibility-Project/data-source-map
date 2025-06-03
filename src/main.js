import { createApp } from 'vue';
import App from './App.vue';
import 'pdap-design-system/styles';

import router from './router';

// Import Font Awesome
import { library } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { 
  faChevronLeft, 
  faArrowRight 
} from '@fortawesome/free-solid-svg-icons';

// Add icons to library
library.add(faChevronLeft, faArrowRight);

const app = createApp(App);

app.use(router);
app.component('font-awesome-icon', FontAwesomeIcon);

app.mount('#app');