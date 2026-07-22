package iters_test

import (
	"testing"

	. "github.com/dennwc/iters"
	"github.com/dennwc/iters/testit"
)

func TestFilterIter(t *testing.T) {
	testit.ExpectIter(t,
		[]int{1, 3, 5}, nil,
		Filter[int](
			Slice([]int{1, 2, 3, 4, 5}),
			func(v int) bool {
				return v%2 == 1
			},
		),
	)

	testit.ExpectIterCtx(t,
		[]int{1, 3, 5}, nil,
		FilterCtx[int](
			Slice([]int{1, 2, 3, 4, 5}),
			func(v int) bool {
				return v%2 == 1
			},
		),
	)

	testit.ExpectPageIter(t,
		[]int{1, 3, 5, 7, 9}, nil,
		FilterPage[int](
			PageSlice([][]int{{1, 2}, {3, 4, 5}, {6, 7, 8, 9}}),
			func(v int) bool {
				return v%2 == 1
			},
		),
	)
}
