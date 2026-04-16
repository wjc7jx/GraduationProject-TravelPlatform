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

    emitFilterChangeDebounced() {
      const self = this as any;
      if (self._debounceTimer) {
        clearTimeout(self._debounceTimer);
      }
      self._debounceTimer = setTimeout(() => {
        this.emitFilterChange();
      }, 350);
    },

    onKeywordInput(e: any) {
      this.setData({ keyword: e.detail.value || '' });
      this.emitFilterChangeDebounced();
    },

    onTagInput(e: any) {
      this.setData({ tag: e.detail.value || '' });
      this.emitFilterChangeDebounced();
    },

    onStartDateChange(e: any) {
      this.setData({ startDate: e.detail.value || '' });
      this.emitFilterChange();
    },

    onEndDateChange(e: any) {
      this.setData({ endDate: e.detail.value || '' });
      this.emitFilterChange();
    },

    onClear() {
      this.setData({
        keyword: '',
        tag: '',
        startDate: '',
        endDate: '',
      });
      this.emitFilterChange();
    },

    toggleAdvanced() {
      this.setData({ showAdvanced: !this.data.showAdvanced });
    }
  },

  lifetimes: {
    detached() {
      const self = this as any;
      if (self._debounceTimer) {
        clearTimeout(self._debounceTimer);
      }
    }
  }
});
