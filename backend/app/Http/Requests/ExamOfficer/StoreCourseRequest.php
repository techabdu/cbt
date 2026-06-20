<?php

namespace App\Http\Requests\ExamOfficer;

use App\Enums\Semester;
use App\Enums\StudentLevel;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreCourseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $schoolId = $this->attributes->get('school_id');

        return [
            'department_id' => ['required', 'integer',
                Rule::exists('departments', 'id')->where('school_id', $schoolId)],
            'title'         => ['required', 'string', 'max:255'],
            'code'          => ['required', 'string', 'max:20',
                Rule::unique('courses', 'code')->where('school_id', $schoolId)],
            'credit_units'  => ['required', 'integer', 'min:1', 'max:10'],
            'level'         => ['required', Rule::enum(StudentLevel::class)],
            'semester'      => ['required', Rule::enum(Semester::class)],
        ];
    }
}
