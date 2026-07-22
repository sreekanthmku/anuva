package iters_test

import (
	"context"
	"testing"

	. "github.com/dennwc/iters"
	"github.com/dennwc/iters/testit"
)

func TestPageIter(t *testing.T) {
	ctx := context.Background()
	testit.ExpectIter(t,
		[]int(nil), nil,
		PagesAsIter[int](ctx, Slice[int](nil)),
	)
	testit.ExpectIterCtx(t,
		[]int(nil), nil,
		PagesAsIterCtx[int](Slice[int](nil)),
	)
	testit.ExpectPageIter(t,
		[]int(nil), nil,
		IterWithPage[int](Slice[int](nil), 10),
	)

	testit.ExpectIter(t,
		[]int{1, 2, 3, 4, 5, 6, 7, 8, 9}, nil,
		PagesAsIter[int](ctx, Slice([]int{1, 2, 3, 4, 5, 6, 7, 8, 9})),
	)
	testit.ExpectIterCtx(t,
		[]int{1, 2, 3, 4, 5, 6, 7, 8, 9}, nil,
		PagesAsIterCtx[int](Slice([]int{1, 2, 3, 4, 5, 6, 7, 8, 9})),
	)
	testit.ExpectPageIter(t,
		[]int{1, 2, 3, 4, 5, 6, 7, 8, 9}, nil,
		IterWithPage[int](Slice([]int{1, 2, 3, 4, 5, 6, 7, 8, 9}), 3),
	)

	testit.ExpectPageIter(t,
		[]int{1, 2, 3, 4, 5, 6, 7, 8, 9}, nil,
		IterWithPage[int](PagesAsIter[int](ctx, Slice([]int{1, 2, 3, 4, 5, 6, 7, 8, 9})), 3),
	)
	testit.ExpectPageIter(t,
		[]int{1, 2, 3, 4, 5, 6, 7, 8, 9}, nil,
		IterWithPageCtx[int](PagesAsIterCtx[int](Slice([]int{1, 2, 3, 4, 5, 6, 7, 8, 9})), 3),
	)
	testit.ExpectIter(t,
		[]int{1, 2, 3, 4, 5, 6, 7, 8, 9}, nil,
		PagesAsIter[int](ctx, IterWithPage[int](Slice([]int{1, 2, 3, 4, 5, 6, 7, 8, 9}), 3)),
	)
}
