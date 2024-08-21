const Knex = require('knex');

module.exports.attachPaginate = function attachPaginate() {
  function paginate({ perPage = 10, currentPage = 1, isFromStart = false, isLengthAware = false, transaction }) {
    if (isNaN(perPage)) {
      throw new Error('Paginate error: perPage must be a number.');
    }

    if (isNaN(currentPage)) {
      throw new Error('Paginate error: currentPage must be a number.');
    }

    if (typeof isFromStart !== 'boolean') {
      throw new Error('Paginate error: isFromStart must be a boolean.');
    }

    if (typeof isLengthAware !== 'boolean') {
      throw new Error('Paginate error: isLengthAware must be a boolean.');
    }

    if (currentPage < 1) {
      currentPage = 1;
    }

    const shouldFetchTotals = isLengthAware || currentPage === 1 || isFromStart;
    let pagination = {};
    let countQuery = null;

    const offset = isFromStart ? 0 : (currentPage - 1) * perPage;
    const limit = isFromStart ? perPage * currentPage : perPage;
    const client = transaction?.client || this.client;

    const postProcessResponse =
      typeof client.config.postProcessResponse === 'function'
        ? client.config.postProcessResponse
        : function (key) {
          return key;
        };

    if (shouldFetchTotals) {
      if (transaction) {
        countQuery = transaction
          .count('* as total')
          .from(this.clone().offset(0).clearOrder().as('count__query__'))
          .first()
          .debug(this._debug);
      } else {
        countQuery = new this.constructor(client)
          .count('* as total')
          .from(this.clone().offset(0).clearOrder().as('count__query__'))
          .first()
          .debug(this._debug);
      }
    }

    // This will paginate the data itself
    this.offset(offset).limit(limit);

    // Get transaction result
    return this.then(async (result) => {
      if (shouldFetchTotals) {
        const countResult = await countQuery
        const total = +(countResult.TOTAL || countResult.total || 0);
        const lastPage = Math.ceil(total / perPage);
        pagination = {
          total,
          lastPage,
          prevPage: currentPage > 1 ? currentPage - 1 : null,
          nextPage: currentPage < lastPage ? currentPage + 1 : null,
        };
      }

      // Add pagination data to paginator object
      pagination = postProcessResponse({
        ...pagination,
        perPage,
        currentPage,
        from: offset,
        to: offset + result.length,
      });

      return { data: result, pagination };
    })
  }

  Knex.QueryBuilder.extend('paginate', paginate);
};
