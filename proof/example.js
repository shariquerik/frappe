import { Badge } from 'frappe-ui'

const DealStage = {
  components: { Badge },
  props: { page: Object },
  template: `
    <div class="flex items-center gap-2">
      <Badge :label="page.doc.status" :theme="page.doc.status === 'Won' ? 'green' : 'gray'" />
      <span v-if="page.doc.probability" class="text-sm text-ink-gray-5">
        {{ __('{0}% likely', [page.doc.probability]) }}
      </span>
    </div>
  `,
}

export default {
  onRefresh(page) {
    page.header.add({ name: 'deal_stage', zone: 'left', component: DealStage }, { after: 'record' })
  },
}
