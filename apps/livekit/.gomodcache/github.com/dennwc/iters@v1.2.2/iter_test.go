package iters

import (
	"context"
	"io"
)

type TIter = Iter[int]
type TIterCtx = IterCtx[int]
type TPageIter = PageIter[int]
type TPagedIter = PagedIter[int]

var (
	_ TIter      = (*CloseIter)(nil)
	_ TIterCtx   = (*CloseIter)(nil)
	_ TPageIter  = (*CloseIter)(nil)
	_ TPagedIter = (*CloseIter)(nil)
)

type CloseIter struct {
	Closed bool
}

func (it *CloseIter) Next() (int, error) {
	return 0, io.EOF
}

func (it *CloseIter) NextCtx(ctx context.Context) (int, error) {
	return 0, io.EOF
}

func (it *CloseIter) NextPage(ctx context.Context) ([]int, error) {
	return nil, io.EOF
}

func (it *CloseIter) Close() {
	it.Closed = true
}
