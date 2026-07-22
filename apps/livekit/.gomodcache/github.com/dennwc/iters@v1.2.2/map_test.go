package iters_test

import (
	"context"
	"testing"

	. "github.com/dennwc/iters"
	"github.com/dennwc/iters/testit"
)

func TestMapIter(t *testing.T) {
	testit.ExpectIter(t,
		[]int{10, 20, 30}, nil,
		Map[int, int](
			Slice([]int{1, 2, 3}),
			func(v int) (int, error) {
				return v * 10, nil
			},
		),
	)

	testit.ExpectIterCtx(t,
		[]int{10, 20, 30}, nil,
		MapCtx[int, int](
			Slice([]int{1, 2, 3}),
			func(ctx context.Context, v int) (int, error) {
				return v * 10, nil
			},
		),
	)

	testit.ExpectPageIter(t,
		[]int{10, 20, 30, 40, 50}, nil,
		MapPage[int, int](
			PageSlice([][]int{{1, 2}, {3}, {4, 5}}),
			func(ctx context.Context, v int) (int, error) {
				return v * 10, nil
			},
		),
	)
}
