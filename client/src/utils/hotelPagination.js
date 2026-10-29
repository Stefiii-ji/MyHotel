export async function getAllCityHotels(
  fetchPage,
  { city, limit, signal, concurrency = 4 },
) {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new RangeError('Hotel page concurrency must be a positive integer');
  }

  const firstPage = await fetchPage({ city, page: 1, limit }, { signal });
  const hotels = [...firstPage.items];
  const totalPages = firstPage.pagination.totalPages;

  for (let page = 2; page <= totalPages;) {
    const pageNumbers = Array.from(
      { length: Math.min(concurrency, totalPages - page + 1) },
      (_value, index) => page + index,
    );
    const results = await Promise.all(
      pageNumbers.map((currentPage) =>
        fetchPage({ city, page: currentPage, limit }, { signal }),
      ),
    );
    hotels.push(...results.flatMap((result) => result.items));
    page += pageNumbers.length;
  }

  return hotels;
}
