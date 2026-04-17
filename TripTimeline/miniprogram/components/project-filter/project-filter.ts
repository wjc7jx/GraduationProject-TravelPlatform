type FilterPayload = {
  keyword: string;
  tag: string;
  startDate: string;
  endDate: string;
};

Component({
  data: {
    keyword: '',
    tag: '',
    startDate: '',
    endDate: '',
    showAdvanced: false,
  },

  methods: {
    emitFilterChange() {
      const payload: FilterPayload = {
        keyword: (this.data.keyword || '').trim(),
        tag: (this.data.tag || '').trim(),
        startDate: this.data.startDate || '',
        endDate: this.data.endDate || '',
      };
      this.triggerEvent('filterchange', payload);
    },

    onKeywordInput(e: any) {
      this.setData({ keyword: e.detail.value || '' });
    },

    onKeywordConfirm() {
      this.emitFilterChange();
    },

    onTagInput(e: any) {
      this.setData({ tag: e.detail.value || '' });
    },

    onStartDateChange(e: any) {
      this.setData({ startDate: e.detail.value || '' });
    },

    onEndDateChange(e: any) {
      this.setData({ endDate: e.detail.value || '' });
    },

    onClear() {
      this.setData({
        keyword: '',
        tag: '',
        startDate: '',
        endDate: '',
      });
    },

    onApply() {
      this.emitFilterChange();
      this.setData({ showAdvanced: false });
    },

    closeAdvanced() {
      this.setData({ showAdvanced: false });
    },

    noop() {},

    toggleAdvanced() {
      this.setData({ showAdvanced: !this.data.showAdvanced });
    }
  }
});
